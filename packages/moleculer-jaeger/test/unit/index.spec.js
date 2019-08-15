"use strict";

jest.mock("jaeger-client");
const Jaeger = require("jaeger-client");

jest.mock("jaeger-client/dist/src/samplers/guaranteed_throughput_sampler");
const GuaranteedThroughputSampler = require("jaeger-client/dist/src/samplers/guaranteed_throughput_sampler").default;

jest.mock("jaeger-client/dist/src/samplers/remote_sampler");
const RemoteControlledSampler = require("jaeger-client/dist/src/samplers/remote_sampler").default;

jest.mock("jaeger-client/dist/src/reporters/udp_sender");
const UDPSender = require("jaeger-client/dist/src/reporters/udp_sender").default;

const { ServiceBroker } = require("moleculer");
const JaegerService = require("../../src");

describe("Test JaegerService constructor", () => {
	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(JaegerService);

	it("should be created", () => {
		expect(service).toBeDefined();
		expect(service.tracers).toBeInstanceOf(Object);
	});

});

describe("Test JaegerService started & stopped", () => {

	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(JaegerService);

	beforeAll(() => broker.start());

	it("should start timer", () => {
		expect(service).toBeDefined();
		// No logic in `started`
	});

	it("should destroy timer", () => {
		const close = jest.fn();
		service.tracers.first = { close };
		service.tracers.second = { close };
		return broker.stop().then(() => {
			expect(service.tracers).toEqual({});
			expect(close).toHaveBeenCalledTimes(2);
			expect(close).toHaveBeenCalledWith();
		});
	});

});

describe("Test event listener", () => {
	const broker = new ServiceBroker({ logger: false });

	beforeAll(() => broker.start());
	afterAll(() => broker.stop());

	it("should call makePayload method", () => {
		const service = broker.createService(JaegerService);
		service.makePayload = jest.fn();

		return broker.Promise.delay(100).then(() => {
			const payload = { a: 5 };
			broker.emit("metrics.trace.span.finish", payload);

			expect(service.makePayload).toHaveBeenCalledTimes(1);
			expect(service.makePayload).toHaveBeenCalledWith(payload);
		});
	});

});

describe("Test common methods", () => {
	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(JaegerService);

	beforeEach(() => broker.start());
	afterEach(() => broker.stop());

	it("should give back the service name from payload", () => {
		expect(service.getServiceName({ service: "serviceA" })).toBe("serviceA");
		expect(service.getServiceName({ action: { name: "serviceB.actionC" } })).toBe("serviceB");
		expect(service.getServiceName({ action: { name: "serviceB.actionC" } })).toBe("serviceB");
		expect(service.getServiceName({ action: { name: "service.nested.action" } })).toBe("service.nested");
		expect(service.getServiceName({ service: { name: "serviceD", version: 3 } })).toBe("serviceD");
	});

	it("should give back the span name from payload", () => {
		expect(service.getSpanName({ name: "custom-event" })).toBe("custom-event");
		expect(service.getSpanName({ action: { name: "service.action" } })).toBe("service.action");
	});

	it("should convert context ID to Zipkin ID", () => {
		expect(service.convertID("12345-67890-abcdef-12345")).toEqual(Buffer.from([18, 52, 86, 120, 144, 171, 205, 239]));
		expect(service.convertID()).toBe(null);
	});

});

describe("Test payload creating", () => {
	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(JaegerService);

	beforeEach(() => broker.start());
	afterEach(() => broker.stop());

	it("test addTags method with string", () => {
		const span = { setTag: jest.fn((name, value) => span[name] = value) };
		service.addTags(span, "first", "Hello");

		expect(span).toEqual({
			first: "Hello",
			setTag: jasmine.any(Function)
		});
	});

	it("test addTags method with number", () => {
		const span = { setTag: jest.fn((name, value) => span[name] = value) };
		service.addTags(span, "first", 500.32);

		expect(span).toEqual({
			first: 500.32,
			setTag: jasmine.any(Function)
		});
	});

	it("test addTags method with boolean", () => {
		const span = { setTag: jest.fn((name, value) => span[name] = value) };
		service.addTags(span, "first", true);

		expect(span).toEqual({
			first: true,
			setTag: jasmine.any(Function)
		});
	});

	it("test addTags method with null", () => {
		const span = { setTag: jest.fn((name, value) => span[name] = value) };
		service.addTags(span, "first", null);

		expect(span).toEqual({
			"first": null,
			setTag: jasmine.any(Function)
		});
	});

	it("test addTags method with undefined", () => {
		const span = { setTag: jest.fn((name, value) => span[name] = value) };
		service.addTags(span, "first", undefined);

		expect(span).toEqual({
			setTag: jasmine.any(Function)
		});
	});

	it("test addTags method with object", () => {
		const span = { setTag: jest.fn((name, value) => span[name] = value) };
		service.addTags(span, "first", { a: 5, b: { c: "John", d: true } });

		expect(span).toEqual({
			"first.a": 5,
			"first.b.c": "John",
			"first.b.d": true,
			setTag: jasmine.any(Function)
		});
	});

	it("test addTags method with array", () => {
		const span = { setTag: jest.fn((name, value) => span[name] = value) };
		service.addTags(span, "first", ["John", "Jane"]);

		expect(span).toEqual({
			"first.0": "John",
			"first.1": "Jane",
			setTag: jasmine.any(Function)
		});
	});

	it("should generate v2 Zipkin span", () => {
		const payload = {
			id: "48be6b2f-0ee6-4851-a326-ff92fdd98045",
			requestID: "60ff2991-5c67-4a1d-8022-70a95be86039",
			level: 2,
			startTime: 1520505261078,
			endTime: 1520505261142.4363,
			duration: 64.436225,
			remoteCall: false,
			fromCache: false,
			params: { postID: 3 },
			meta: { user: { name: "John" } },
			action: { name: "votes.count" },
			parent: "60ff2991-5c67-4a1d-8022-70a95be86039",
			nodeID: "node-100"
		};

		const spanCtx = {};

		const span = {
			finish: jest.fn(),
			context: jest.fn(() => spanCtx)
		};

		const startSpan = jest.fn(() => span);
		service.getTracer = jest.fn(() => ({ startSpan }));

		service.addTags = jest.fn();

		service.makePayload(payload);

		expect(service.getTracer).toHaveBeenCalledTimes(1);
		expect(service.getTracer).toHaveBeenCalledWith("votes");

		expect(Jaeger.SpanContext).toHaveBeenCalledTimes(1);
		expect(Jaeger.SpanContext).toHaveBeenCalledWith(
			Buffer.from([96, 255, 41, 145, 92, 103, 74, 29]),
			Buffer.from([96, 255, 41, 145, 92, 103, 74, 29]),
			null,
			null,
			null,
			null,
			1,
			{},
			""
		);

		expect(startSpan).toHaveBeenCalledTimes(1);
		expect(startSpan).toHaveBeenCalledWith("votes.count", {
			startTime: 1520505261078,
			childOf: jasmine.any(Jaeger.SpanContext),
			tags: {
				nodeID: "node-100",
				level: 2,
				remoteCall: false
			}
		});

		expect(service.addTags).toHaveBeenCalledTimes(5);
		expect(service.addTags).toHaveBeenCalledWith(span, "service", "votes");
		expect(service.addTags).toHaveBeenCalledWith(span, "action", "votes.count");
		expect(service.addTags).toHaveBeenCalledWith(span, "params", { "postID": 3 });
		expect(service.addTags).toHaveBeenCalledWith(span, "meta", { "user": { "name": "John" } });

		expect(span.context).toHaveBeenCalledTimes(1);
		expect(span.context).toHaveBeenCalledWith();

		expect(spanCtx.traceId).toEqual(Buffer.from([96, 255, 41, 145, 92, 103, 74, 29]));
		expect(spanCtx.spanId).toEqual(Buffer.from([72, 190, 107, 47, 14, 230, 72, 81]));

		expect(span.finish).toHaveBeenCalledTimes(1);
		expect(span.finish).toHaveBeenCalledWith(1520505261142.4363);

	});

	it("should generate v2 Zipkin span with error", () => {
		Jaeger.SpanContext.mockClear();

		const payload = {
			id: "48be6b2f-0ee6-4851-a326-ff92fdd98045",
			requestID: "60ff2991-5c67-4a1d-8022-70a95be86039",
			level: 2,
			startTime: 1520505261078,
			endTime: 1520505261142.4363,
			duration: 64.436225,
			remoteCall: false,
			fromCache: false,
			meta: { user: { name: "John" } },
			action: { name: "votes.count" },
			parent: "60ff2991-5c67-4a1d-8022-70a95be86039",
			nodeID: "node-100",
			callerNodeID: "node-99",
			error: {
				message: "Something went wrong!",
				code: 401,
				type: "WRONG_THING",
				data: {
					a: 5
				},
				stack: "error stack"
			}
		};


		const spanCtx = {};

		const span = {
			finish: jest.fn(),
			context: jest.fn(() => spanCtx)
		};

		const startSpan = jest.fn(() => span);
		service.getTracer = jest.fn(() => ({ startSpan }));

		service.addTags = jest.fn();

		service.makePayload(payload);

		expect(service.getTracer).toHaveBeenCalledTimes(1);
		expect(service.getTracer).toHaveBeenCalledWith("votes");

		expect(Jaeger.SpanContext).toHaveBeenCalledTimes(1);
		expect(Jaeger.SpanContext).toHaveBeenCalledWith(
			Buffer.from([96, 255, 41, 145, 92, 103, 74, 29]),
			Buffer.from([96, 255, 41, 145, 92, 103, 74, 29]),
			null,
			null,
			null,
			null,
			1,
			{},
			""
		);

		expect(startSpan).toHaveBeenCalledTimes(1);
		expect(startSpan).toHaveBeenCalledWith("votes.count", {
			startTime: 1520505261078,
			childOf: jasmine.any(Jaeger.SpanContext),
			tags: {
				nodeID: "node-100",
				level: 2,
				remoteCall: false
			}
		});

		expect(service.addTags).toHaveBeenCalledTimes(11);
		expect(service.addTags).toHaveBeenCalledWith(span, "service", "votes");
		expect(service.addTags).toHaveBeenCalledWith(span, "action", "votes.count");
		expect(service.addTags).toHaveBeenCalledWith(span, "meta", { "user": { "name": "John" } });
		expect(service.addTags).toHaveBeenCalledWith(span, "callerNodeID", "node-99");

		expect(service.addTags).toHaveBeenCalledWith(span, "error", true);
		expect(service.addTags).toHaveBeenCalledWith(span, "error.message", "Something went wrong!");
		expect(service.addTags).toHaveBeenCalledWith(span, "error.type", "WRONG_THING");
		expect(service.addTags).toHaveBeenCalledWith(span, "error.code", 401);
		expect(service.addTags).toHaveBeenCalledWith(span, "error.data", { a: 5 });
		expect(service.addTags).toHaveBeenCalledWith(span, "error.stack", "error stack");

		expect(span.context).toHaveBeenCalledTimes(1);
		expect(span.context).toHaveBeenCalledWith();

		expect(spanCtx.traceId).toEqual(Buffer.from([96, 255, 41, 145, 92, 103, 74, 29]));
		expect(spanCtx.spanId).toEqual(Buffer.from([72, 190, 107, 47, 14, 230, 72, 81]));

		expect(span.finish).toHaveBeenCalledTimes(1);
		expect(span.finish).toHaveBeenCalledWith(1520505261142.4363);
	});
});

describe("Test getSampler method", () => {

	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(JaegerService);

	beforeEach(() => broker.start());
	afterEach(() => broker.stop());

	it("should return sampler func", () => {
		service.settings.sampler = () => {};
		expect(service.getSampler()).toBe(service.settings.sampler);
	});

	it("should return RateLimitingSampler", () => {
		service.settings.sampler = {
			type: "RateLimiting",
			options: {
				maxTracesPerSecond: 123,
				initBalance: 22
			}
		};

		service.getSampler();

		expect(Jaeger.RateLimitingSampler).toHaveBeenCalledTimes(1);
		expect(Jaeger.RateLimitingSampler).toHaveBeenCalledWith(123, 22);
	});

	it("should return ProbabilisticSampler", () => {
		service.settings.sampler = {
			type: "Probabilistic",
			options: {
				samplingRate: 123
			}
		};

		service.getSampler();

		expect(Jaeger.ProbabilisticSampler).toHaveBeenCalledTimes(1);
		expect(Jaeger.ProbabilisticSampler).toHaveBeenCalledWith(123);
	});

	it("should return GuaranteedThroughputSampler", () => {
		service.settings.sampler = {
			type: "GuaranteedThroughput",
			options: {
				lowerBound: 22,
				samplingRate: 33
			}
		};

		service.getSampler();

		expect(GuaranteedThroughputSampler).toHaveBeenCalledTimes(1);
		expect(GuaranteedThroughputSampler).toHaveBeenCalledWith(22, 33);
	});

	it("should return RemoteControlledSampler", () => {
		service.settings.sampler = {
			type: "RemoteControlled",
			options: {
				a: 5
			}
		};

		service.getSampler("posts");

		expect(RemoteControlledSampler).toHaveBeenCalledTimes(1);
		expect(RemoteControlledSampler).toHaveBeenCalledWith("posts", service.settings.sampler.options);
	});

	it("should return ConstSampler with default config", () => {
		service.settings.sampler = {};

		service.getSampler();

		expect(Jaeger.ConstSampler).toHaveBeenCalledTimes(1);
		expect(Jaeger.ConstSampler).toHaveBeenCalledWith(1);
	});

	it("should return ConstSampler with default config", () => {
		Jaeger.ConstSampler.mockClear();

		service.settings.sampler = {
			type: "Const",
			options: {
				decision: 0
			}
		};

		service.getSampler();

		expect(Jaeger.ConstSampler).toHaveBeenCalledTimes(1);
		expect(Jaeger.ConstSampler).toHaveBeenCalledWith(0);
	});

});

describe("Test getReporter method", () => {

	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(JaegerService);

	beforeEach(() => broker.start());
	afterEach(() => broker.stop());

	it("should return RemoteReporter", () => {
		service.settings = {
			host: "192.168.0.100",
			port: 6789
		};

		service.getReporter();

		expect(Jaeger.RemoteReporter).toHaveBeenCalledTimes(1);
		expect(Jaeger.RemoteReporter).toHaveBeenCalledWith(jasmine.any(UDPSender));

		expect(UDPSender).toHaveBeenCalledTimes(1);
		expect(UDPSender).toHaveBeenCalledWith({ host: "192.168.0.100", port: 6789 });
	});
});

describe("Test getTracer method", () => {

	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService(JaegerService);

	let tracer;

	beforeAll(() => broker.start());
	afterAll(() => broker.stop());

	it("should create a new tracer", () => {
		const sampler = { a: 5 };
		const reporter = { b: 6 };
		service.getSampler = jest.fn(() => sampler);
		service.getReporter = jest.fn(() => reporter);

		service.settings.options = {
			c: 7
		};

		tracer = service.getTracer("posts");

		expect(tracer).toBeInstanceOf(Jaeger.Tracer);

		expect(service.getSampler).toHaveBeenCalledTimes(1);
		expect(service.getSampler).toHaveBeenCalledWith();

		expect(service.getReporter).toHaveBeenCalledTimes(1);
		expect(service.getReporter).toHaveBeenCalledWith();

		expect(Jaeger.Tracer).toHaveBeenCalledTimes(1);
		expect(Jaeger.Tracer).toHaveBeenCalledWith("posts", reporter, sampler, service.settings.options);

		expect(service.tracers).toEqual({
			"posts": tracer
		});
	});

	it("should return the previous tracer", () => {
		service.getSampler.mockClear();
		service.getReporter.mockClear();
		Jaeger.Tracer.mockClear();

		const tracer2 = service.getTracer("posts");

		expect(tracer2).toBe(tracer);

		expect(service.getSampler).toHaveBeenCalledTimes(0);

		expect(service.getReporter).toHaveBeenCalledTimes(0);

		expect(Jaeger.Tracer).toHaveBeenCalledTimes(0);

		expect(service.tracers).toEqual({
			"posts": tracer
		});
	});
});
