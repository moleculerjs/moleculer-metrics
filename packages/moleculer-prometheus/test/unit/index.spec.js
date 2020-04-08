"use strict";

jest.mock("polka");
const Polka = require("polka");
let pathCB;
const MockPolka = {
	listen: jest.fn(() => Promise.resolve()),
	get: jest.fn((path, cb) => {
		pathCB = cb;
	}),
	server: {
		close: jest.fn()
	}
};
Polka.mockImplementation(() => MockPolka);

jest.mock("prom-client");
const Prometheus = require("prom-client");
Prometheus.collectDefaultMetrics = jest.fn(() => ({}));
//Prometheus.mockImplementation(() => MockPromClient);

const { ServiceBroker } = require("moleculer");
const PromService = require("../../src");

describe("Test PromService constructor", () => {
	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(PromService);

	it("should be created", () => {
		expect(service).toBeDefined();
		expect(service.server).toBeDefined();
	});
});

describe("Test PromService started & stopped", () => {

	describe("with default settings", () => {

		const broker = new ServiceBroker({ logger: false });
		const service = broker.createService(PromService);

		service.createMetrics = jest.fn();

		Prometheus.collectDefaultMetrics.mockClear();
		MockPolka.get.mockClear();
		MockPolka.listen.mockClear();

		beforeAll(() => broker.start());

		it("should start service", () => {
			expect(service).toBeDefined();
			expect(service.client).toBe(Prometheus);

			expect(Prometheus.collectDefaultMetrics).toHaveBeenCalledTimes(1);
			expect(Prometheus.collectDefaultMetrics).toHaveBeenCalledWith({ timeout: 10000, register: expect.any(Prometheus.Registry) });

			expect(service.createMetrics).toHaveBeenCalledTimes(1);
			expect(service.createMetrics).toHaveBeenCalledWith(service.settings.metrics);

			expect(service.timer).toBeDefined();

			expect(MockPolka.get).toHaveBeenCalledTimes(1);
			expect(MockPolka.get).toHaveBeenCalledWith("/metrics", jasmine.any(Function));

			expect(MockPolka.listen).toHaveBeenCalledTimes(1);
			expect(MockPolka.listen).toHaveBeenCalledWith(3030);
		});

		it("should set res header and content", () => {
			const res = {
				setHeader: jest.fn(),
				end: jest.fn()
			};
			service.register.metrics = jest.fn(() => "data");

			pathCB(null, res);

			expect(res.setHeader).toHaveBeenCalledTimes(1);
			expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/plain; version=0.0.4; charset=utf-8");

			expect(res.end).toHaveBeenCalledTimes(1);
			expect(res.end).toHaveBeenCalledWith("data");
			expect(service.register.metrics).toHaveBeenCalledTimes(1);
		});

		it("should destroy timer", () => {
			global.clearInterval = jest.fn();
			const timer = service.timer;

			return broker.stop().then(() => {
				expect(clearInterval).toHaveBeenCalledTimes(1);
				expect(clearInterval).toHaveBeenCalledWith(timer);

				expect(MockPolka.server.close).toHaveBeenCalledTimes(1);
				expect(MockPolka.server.close).toHaveBeenCalledWith();
			});
		});

		it("change settings", () => {
			service.settings = {
				collectDefaultMetrics: false,
				port: 4567
			};

			service.createMetrics = jest.fn();
			Prometheus.collectDefaultMetrics.mockClear();
			MockPolka.get.mockClear();
			MockPolka.listen.mockClear();

			return broker.start();
		});

		it("should not start timer", () => {
			expect(service).toBeDefined();
			expect(service.client).toBe(Prometheus);

			expect(Prometheus.collectDefaultMetrics).toHaveBeenCalledTimes(0);

			expect(service.createMetrics).toHaveBeenCalledTimes(1);
			expect(service.createMetrics).toHaveBeenCalledWith(service.settings.metrics);

			expect(service.timer).toBeNull();

			expect(MockPolka.get).toHaveBeenCalledTimes(1);
			expect(MockPolka.get).toHaveBeenCalledWith("/metrics", jasmine.any(Function));

			expect(MockPolka.listen).toHaveBeenCalledTimes(1);
			expect(MockPolka.listen).toHaveBeenCalledWith(4567);
		});

		it("should not destroy timer", () => {
			MockPolka.server.close.mockClear();
			global.clearInterval = jest.fn();

			return broker.stop().then(() => {
				expect(clearInterval).toHaveBeenCalledTimes(0);

				expect(MockPolka.server.close).toHaveBeenCalledTimes(1);
				expect(MockPolka.server.close).toHaveBeenCalledWith();
			});
		});
	});

});

describe("Test event listeners", () => {
	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(PromService);
	service.update = jest.fn();
	service.updateCommonValues = jest.fn();

	beforeAll(() => broker.start());
	afterAll(() => broker.stop());

	describe("emit 'metrics.trace.span.finish'", () => {

		it("should update request metrics", () => {

			const payload = { name: "posts.find", service: "posts", nodeID: "node-2", duration: 31.56 };
			broker.emit("metrics.trace.span.finish", payload);

			expect(service.update).toHaveBeenCalledTimes(2);
			expect(service.update).toHaveBeenCalledWith("moleculer_req_total", "inc", { action: "posts.find", service: "posts", nodeID: "node-2" });
			expect(service.update).toHaveBeenCalledWith("moleculer_req_duration_ms", "observe", { action: "posts.find", service: "posts", nodeID: "node-2" }, payload.duration);
		});

		it("should update request metrics", () => {
			service.update.mockClear();

			const payload = { name: "posts.find", service: "posts", nodeID: "node-2", duration: 31.56, error: {
				code: 501,
				type: "NOT_FOUND",
				name: "MoleculerError"
			} };
			broker.emit("metrics.trace.span.finish", payload);

			expect(service.update).toHaveBeenCalledTimes(3);
			expect(service.update).toHaveBeenCalledWith("moleculer_req_total", "inc", { action: "posts.find", service: "posts", nodeID: "node-2" });
			expect(service.update).toHaveBeenCalledWith("moleculer_req_duration_ms", "observe", { action: "posts.find", service: "posts", nodeID: "node-2" }, payload.duration);
			expect(service.update).toHaveBeenCalledWith("moleculer_req_errors_total", "inc", {
				action: "posts.find",
				service: "posts",
				nodeID: "node-2",
				errorCode: 501,
				errorName: "MoleculerError",
				errorType: "NOT_FOUND"
			});
		});
	});

	describe("emit 'metrics.update'", () => {

		it("should update metric value", () => {
			service.update.mockClear();

			const payload = { name: "transporter.packet.count", method: "set", labels: { type: "sent" }, value: 123, timestamp: Date.now() };
			broker.emit("metrics.update", payload);

			expect(service.update).toHaveBeenCalledTimes(1);
			expect(service.update).toHaveBeenCalledWith("transporter.packet.count", "set", { type: "sent" }, 123, payload.timestamp);
		});

	});

	describe("emit '$services.changed'", () => {

		it("should update metric value", () => {
			service.updateCommonValues.mockClear();

			broker.emit("$services.changed");

			expect(service.updateCommonValues).toHaveBeenCalledTimes(1);
			expect(service.updateCommonValues).toHaveBeenCalledWith();
		});

	});

	describe("emit '$node.connected'", () => {

		it("should update metric value", () => {
			service.updateCommonValues.mockClear();

			broker.emit("$node.connected");

			expect(service.updateCommonValues).toHaveBeenCalledTimes(1);
			expect(service.updateCommonValues).toHaveBeenCalledWith();
		});

	});

	describe("emit '$node.disconnected'", () => {

		it("should update metric value", () => {
			service.updateCommonValues.mockClear();

			broker.emit("$node.disconnected");

			expect(service.updateCommonValues).toHaveBeenCalledTimes(1);
			expect(service.updateCommonValues).toHaveBeenCalledWith();
		});

	});

});

describe("Test common methods", () => {
	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(PromService);

	beforeEach(() => broker.start());
	afterEach(() => broker.stop());

	it("should give back the service name from payload", () => {
		expect(service.getServiceName({ service: "serviceA" })).toBe("serviceA");
		expect(service.getServiceName({ action: { name: "serviceB.actionC" }})).toBe("serviceB");
		expect(service.getServiceName({ action: { name: "serviceB.actionC" }})).toBe("serviceB");
		expect(service.getServiceName({ action: { name: "service.nested.action" }})).toBe("service.nested");
		expect(service.getServiceName({ service: { name: "serviceD", version: 3 }})).toBe("serviceD");
	});

	it("should give back the span name from payload", () => {
		expect(service.getSpanName({ name: "custom-event" })).toBe("custom-event");
		expect(service.getSpanName({ action: { name: "service.action" }})).toBe("service.action");
	});

});

describe("Test createMetrics method", () => {
	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(PromService);

	beforeEach(() => {
		broker.start();

		service.updateCommonValues = jest.fn();
		Prometheus.Gauge.mockClear();
		Prometheus.Counter.mockClear();
		Prometheus.Histogram.mockClear();
	});
	afterEach(() => broker.stop());

	it("should not create metric objects if empty", () => {
		service.createMetrics();

		expect(service.updateCommonValues).toHaveBeenCalledTimes(0);

		expect(service.metrics).toEqual({});
	});

	it("should create metric objects according to metrics settings", () => {
		service.createMetrics({
			"custom_val1": { type: "Gauge", labelNames: [ "nodeID", "service"], help: "Custom value 1" },
			"custom_val2": { type: "Counter", labelNames: [ "nodeID" ], help: "Custom value 2" },
			"custom_val3": { type: "Histogram", labelNames: [ "nodeID" ], help: "Custom value 3" },
			"custom_val4": null
		});

		expect(Prometheus.Gauge).toHaveBeenCalledTimes(1);
		expect(Prometheus.Gauge).toHaveBeenCalledWith({"name": "custom_val1", "labelNames": ["nodeID", "service"], "help": "Custom value 1", "type": "Gauge", "registers":[]});

		expect(Prometheus.Counter).toHaveBeenCalledTimes(1);
		expect(Prometheus.Counter).toHaveBeenCalledWith({"name": "custom_val2", "labelNames": ["nodeID"], "help": "Custom value 2", "type": "Counter", "registers":[]});

		expect(Prometheus.Histogram).toHaveBeenCalledTimes(1);
		expect(Prometheus.Histogram).toHaveBeenCalledWith({"name": "custom_val3", "labelNames": ["nodeID"], "help": "Custom value 3", "type": "Histogram", "registers":[]});

		expect(service.metrics).toEqual({
			custom_val1: jasmine.any(Prometheus.Gauge),
			custom_val2: jasmine.any(Prometheus.Counter),
			custom_val3: jasmine.any(Prometheus.Histogram)
		});
	});

});

describe("Test updateCommonValues method", () => {
	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(PromService);

	beforeAll(() => {
		return broker.start().then(() => {
			broker.mcall = jest.fn(() => Promise.resolve({
				nodes: [
					{ id: "node-1", available: true, client: { type: "node", version: "0.12.1", langVersion: "8.10.0" } },
					{ id: "node-2", available: false, client: { type: "node", version: "0.12.1", langVersion: "8.10.0" } }
				],
				services: [
					{ name: "posts", version: 2, nodes: [1,2] },
					{ name: "users", nodes: [] },
				],
				actions: [
					{ name: "posts.find", endpoints: [1,2,3] },
					{ name: "users.find" }
				],
				events: [
					{ name: "user.created", group: "users" },
					{ name: "post.created", group: "posts", endpoints: [1,2,3] },
				]
			}));

			service.update = jest.fn();
		});
	});
	afterAll(() => broker.stop());

	it("should call service.update method", () => {
		service.metrics = {};
		service.update.mockClear();

		return service.updateCommonValues().then(() => {

			expect(broker.mcall).toHaveBeenCalledTimes(1);
			expect(broker.mcall).toHaveBeenCalledWith({
				nodes: { action: "$node.list" },
				services: { action: "$node.services", params: { withActions: false, grouping: true, skipInternal: true } },
				actions: { action: "$node.actions", params: { withEndpoints: true, skipInternal: true } },
				events: { action: "$node.events", params: { withEndpoints: true, skipInternal: true } }
			});

			expect(service.update).toHaveBeenCalledTimes(12);

			expect(service.update).toHaveBeenCalledWith("moleculer_nodes_total", "set", null, 1);
			expect(service.update).toHaveBeenCalledWith("moleculer_nodes", "set", { nodeID: "node-1", type: "node", version: "0.12.1", langVersion: "8.10.0" }, 1);
			expect(service.update).toHaveBeenCalledWith("moleculer_nodes", "set", { nodeID: "node-2", type: "node", version: "0.12.1", langVersion: "8.10.0" }, 0);

			expect(service.update).toHaveBeenCalledWith("moleculer_services_total", "set", null, 2);
			expect(service.update).toHaveBeenCalledWith("moleculer_service_endpoints_total", "set", { service: "posts", version: 2 }, 2);
			expect(service.update).toHaveBeenCalledWith("moleculer_service_endpoints_total", "set", { service: "users", version: undefined }, 0);

			expect(service.update).toHaveBeenCalledWith("moleculer_actions_total", "set", null, 2);
			expect(service.update).toHaveBeenCalledWith("moleculer_action_endpoints_total", "set", { action: "posts.find" }, 3);
			expect(service.update).toHaveBeenCalledWith("moleculer_action_endpoints_total", "set", { action: "users.find" }, 0);

			expect(service.update).toHaveBeenCalledWith("moleculer_events_total", "set", null, 2);
			expect(service.update).toHaveBeenCalledWith("moleculer_event_endpoints_total", "set", { event: "user.created", group: "users" }, 0);
			expect(service.update).toHaveBeenCalledWith("moleculer_event_endpoints_total", "set", { event: "post.created", group: "posts" }, 3);

		});
	});

});

describe("Test update method", () => {
	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(PromService);

	beforeEach(() => broker.start());
	afterEach(() => broker.stop());

	it("should not update value if not exists", () => {
		service.metrics = {};
		service.update("custom_data", "set", null, 5);
	});

	it("should update metric value", () => {
		service.metrics = {
			metric_1: {
				set: jest.fn()
			},

			metric_2: {
				inc: jest.fn()
			}
		};

		service.update("metric_1", "set", { a: 5 }, 120, 123456);

		expect(service.metrics.metric_1.set).toHaveBeenCalledTimes(1);
		expect(service.metrics.metric_1.set).toHaveBeenCalledWith({ a: 5 }, 120, 123456);

		service.update("metric_2", "inc", null, 5, 123456);

		expect(service.metrics.metric_2.inc).toHaveBeenCalledTimes(1);
		expect(service.metrics.metric_2.inc).toHaveBeenCalledWith(5, 123456);
	});

});
