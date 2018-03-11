"use strict";

const axios = require("axios");
const { ServiceBroker } = require("moleculer");
const ZipkinService = require("../../src");

const lolex = require("lolex");

describe("Test ZipkinService constructor", () => {
	const broker = new ServiceBroker();
	const service = broker.createService(ZipkinService);

	it("should be created", () => {
		expect(service).toBeDefined();
		expect(service.queue).toBeInstanceOf(Array);
	});

});

describe("Test ZipkinService started & stopped", () => {

	describe("with batchTime", () => {
		const broker = new ServiceBroker();
		const service = broker.createService(ZipkinService);

		beforeAll(() => broker.start());

		it("should start timer", () => {
			expect(service).toBeDefined();
			expect(service.axios).toBeDefined();
			expect(service.timer).toBeDefined();

			return broker.stop();
		});

		it("should destroy timer", () => {
			expect(service.timer).toBeNull();
		});

	});

	describe("with batchTime & queued items", () => {
		const broker = new ServiceBroker();
		const service = broker.createService(ZipkinService);

		beforeAll(() => broker.start());

		it("should call sendFromQueue at stopping", () => {
			service.sendFromQueue = jest.fn();

			service.queue.push({});

			return broker.stop().then(() => {
				expect(service.sendFromQueue).toHaveBeenCalledTimes(1);
				expect(service.sendFromQueue).toHaveBeenCalledWith();
			});
		});

	});

	describe("without batchTime", () => {
		const broker = new ServiceBroker();
		const service = broker.createService(ZipkinService, {
			settings: {
				batchTime: 0
			}
		});

		beforeAll(() => broker.start());
		beforeAll(() => broker.stop());

		it("should not create timer", () => {
			expect(service).toBeDefined();
			expect(service.axios).toBeDefined();
			expect(service.timer).toBeUndefined();
		});

	});

});

describe("Test event listener", () => {
	const broker = new ServiceBroker();

	it("should call makeZipkinPayloadV1 method", () => {
		const service = broker.createService(ZipkinService, {
			settings: {
				version: "v1"
			}
		});
		service.makeZipkinPayloadV1 = jest.fn();
		service.makeZipkinPayloadV2 = jest.fn();

		const payload = { a: 5 };
		broker.emit("metrics.trace.span.finish", payload);

		expect(service.makeZipkinPayloadV1).toHaveBeenCalledTimes(1);
		expect(service.makeZipkinPayloadV1).toHaveBeenCalledWith(payload);

		expect(service.makeZipkinPayloadV2).toHaveBeenCalledTimes(0);
	});

	it("should call makeZipkinPayloadV2 method", () => {
		const service = broker.createService(ZipkinService, {
			settings: {
				version: "v2"
			}
		});
		service.makeZipkinPayloadV1 = jest.fn();
		service.makeZipkinPayloadV2 = jest.fn();

		const payload = { a: 5 };
		broker.emit("metrics.trace.span.finish", payload);

		expect(service.makeZipkinPayloadV2).toHaveBeenCalledTimes(1);
		expect(service.makeZipkinPayloadV2).toHaveBeenCalledWith(payload);

		expect(service.makeZipkinPayloadV1).toHaveBeenCalledTimes(0);
	});

});

describe("Test common methods", () => {
	const broker = new ServiceBroker();
	const service = broker.createService(ZipkinService);

	beforeEach(() => broker.start());
	afterEach(() => broker.stop());

	it("should give back the service name from payload", () => {
		expect(service.getServiceName({ service: "serviceA" })).toBe("serviceA");
		expect(service.getServiceName({ action: { name: "serviceB.actionC" }})).toBe("serviceB");
		expect(service.getServiceName({ action: { name: "serviceB.actionC" }})).toBe("serviceB");
		expect(service.getServiceName({ action: { name: "service.nested.action" }})).toBe("service.nested");
	});

	it("should give back the span name from payload", () => {
		expect(service.getSpanName({ name: "custom-event" })).toBe("custom-event");
		expect(service.getSpanName({ action: { name: "service.action" }})).toBe("service.action");
	});

	it("should convert context ID to Zipkin ID", () => {
		expect(service.convertID("12345-67890-abcdef-12345")).toBe("1234567890abcdef");
		expect(service.convertID()).toBe(null);
	});

	it("should convert timestamp to Zipkin microseconds", () => {
		expect(service.convertTime(1234567890)).toBe(1234567890000);
		expect(service.convertTime(1234567890.74289)).toBe(1234567890743);
	});

});

describe("Test v1 payload creating", () => {
	const broker = new ServiceBroker();
	const service = broker.createService(ZipkinService, { settings: { version: "v1" }});

	beforeEach(() => broker.start());
	afterEach(() => broker.stop());

	it("test addBinaryAnnotation method with string", () => {
		const payload = { binaryAnnotations: []	};
		service.addBinaryAnnotation(payload, "first", "Hello");

		expect(payload).toEqual({
			binaryAnnotations: [
				{ key: "first", value: "Hello" }
			]
		});
	});

	it("test addBinaryAnnotation method with number", () => {
		const payload = { binaryAnnotations: []	};
		service.addBinaryAnnotation(payload, "first", 500.32);

		expect(payload).toEqual({
			binaryAnnotations: [
				{ key: "first", value: "500.32" }
			]
		});
	});

	it("test addBinaryAnnotation method with boolean", () => {
		const payload = { binaryAnnotations: []	};
		service.addBinaryAnnotation(payload, "first", true);

		expect(payload).toEqual({
			binaryAnnotations: [
				{ key: "first", value: "true" }
			]
		});
	});

	it("test addBinaryAnnotation method with object", () => {
		const payload = { binaryAnnotations: []	};
		service.addBinaryAnnotation(payload, "first", { a: 5, b: { c: "John", d: true }});

		expect(payload).toEqual({
			binaryAnnotations: [
				{ key: "first.a", value: "5"},
				{ key: "first.b.c", value: "John"},
				{ key: "first.b.d", value: "true"}
			]
		});
	});

	it("test addBinaryAnnotation method with array", () => {
		const payload = { binaryAnnotations: []	};
		service.addBinaryAnnotation(payload, "first", ["John", "Jane"]);

		expect(payload).toEqual({
			binaryAnnotations: [
				{ key: "first.0", value: "John"},
				{ key: "first.1", value: "Jane"}
			]
		});
	});

	it("should generate v1 Zipkin span", () => {
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

		service.enqueue = jest.fn();

		service.makeZipkinPayloadV1(payload);

		expect(service.enqueue).toHaveBeenCalledTimes(1);
		expect(service.enqueue).toHaveBeenCalledWith({
			"id": "48be6b2f0ee64851",
			"name": "votes.count",
			"parentId": "60ff29915c674a1d",
			"timestamp": 1520505261142436,
			"traceId": "60ff29915c674a1d",
			"annotations": [
				{
					"endpoint": {
						"ipv4": "",
						"port": 0,
						"serviceName": "votes"
					},
					"timestamp": 1520505261078000,
					"value": "sr"
				},
				{
					"endpoint": {
						"ipv4": "",
						"port": 0,
						"serviceName": "votes"
					},
					"timestamp": 1520505261142436,
					"value": "ss"
				}
			],
			"binaryAnnotations": [
				{
					"key": "nodeID",
					"value": "node-100"
				},
				{
					"key": "level",
					"value": "2"
				},
				{
					"key": "remoteCall",
					"value": "false"
				},
				{
					"key": "callerNodeID",
					"value": ""
				},
				{
					"key": "params.postID",
					"value": "3"
				},
				{
					"key": "meta.user.name",
					"value": "John"
				}
			]
		});
	});

	it("should generate v1 Zipkin span with error", () => {
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

		service.enqueue = jest.fn();

		service.makeZipkinPayloadV1(payload);

		expect(service.enqueue).toHaveBeenCalledTimes(1);
		expect(service.enqueue).toHaveBeenCalledWith({
			"id": "48be6b2f0ee64851",
			"name": "votes.count",
			"parentId": "60ff29915c674a1d",
			"timestamp": 1520505261142436,
			"traceId": "60ff29915c674a1d",
			"annotations": [
				{
					"endpoint": {
						"ipv4": "",
						"port": 0,
						"serviceName": "votes"
					},
					"timestamp": 1520505261078000,
					"value": "sr"
				},
				{
					"endpoint": {
						"ipv4": "",
						"port": 0,
						"serviceName": "votes"
					},
					"timestamp": 1520505261142436,
					"value": "ss"
				},
				{
					"endpoint": {
						"ipv4": "",
						"port": 0,
						"serviceName": "votes"
					},
					"timestamp": 1520505261142436,
					"value": "error"
				}
			],
			"binaryAnnotations": [
				{
					"key": "nodeID",
					"value": "node-100"
				},
				{
					"key": "level",
					"value": "2"
				},
				{
					"key": "remoteCall",
					"value": "false"
				},
				{
					"key": "callerNodeID",
					"value": "node-99"
				},
				{
					"key": "meta.user.name",
					"value": "John"
				},
				{
					"key": "error",
					"value": "Something went wrong!"
				},
				{
					"key": "error.type",
					"value": "WRONG_THING"
				},
				{
					"key": "error.code",
					"value": "401"
				},
				{
					"key": "error.data.a",
					"value": "5"
				},
				{
					"key": "error.stack",
					"value": "error stack"
				}
			],

		});
	});
});

describe("Test v2 payload creating", () => {
	const broker = new ServiceBroker();
	const service = broker.createService(ZipkinService, { settings: { version: "v2" }});

	beforeEach(() => broker.start());
	afterEach(() => broker.stop());

	it("test addTags method with string", () => {
		const payload = { tags: {} };
		service.addTags(payload, "first", "Hello");

		expect(payload).toEqual({
			tags: {
				first: "Hello"
			}
		});
	});

	it("test addTags method with number", () => {
		const payload = { tags: {} };
		service.addTags(payload, "first", 500.32);

		expect(payload).toEqual({
			tags: {
				first: "500.32"
			}
		});
	});

	it("test addTags method with boolean", () => {
		const payload = { tags: {} };
		service.addTags(payload, "first", true);

		expect(payload).toEqual({
			tags: {
				first: "true"
			}
		});
	});

	it("test addTags method with object", () => {
		const payload = { tags: {} };
		service.addTags(payload, "first", { a: 5, b: { c: "John", d: true }});

		expect(payload).toEqual({
			tags: {
				"first.a": "5",
				"first.b.c": "John",
				"first.b.d": "true"
			}
		});
	});

	it("test addTags method with array", () => {
		const payload = { tags: {} };
		service.addTags(payload, "first", ["John", "Jane"]);

		expect(payload).toEqual({
			tags: {
				"first.0": "John",
				"first.1": "Jane"
			}
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

		service.enqueue = jest.fn();

		service.makeZipkinPayloadV2(payload);

		expect(service.enqueue).toHaveBeenCalledTimes(1);
		expect(service.enqueue).toHaveBeenCalledWith({
			"id": "48be6b2f0ee64851",
			"kind": "CONSUMER",
			"name": "votes.count",
			"traceId": "60ff29915c674a1d",
			"parentId": "60ff29915c674a1d",

			"localEndpoint": {
				"serviceName": "votes"
			},
			"remoteEndpoint": {
				"serviceName": "votes"
			},

			"debug": false,
			"shared": false,

			"annotations": [
				{
					"timestamp": 1520505261078000,
					"value": "sr"
				},
				{
					"timestamp": 1520505261142436,
					"value": "ss"
				}
			],

			"tags": {
				"callerNodeID": "",
				"level": "2",
				"nodeID": "node-100",
				"params.postID": "3",
				"meta.user.name": "John",
				"remoteCall": "false"
			},
			"timestamp": 1520505261078000,
			"durationMicros": 64436
		});
	});

	it("should generate v2 Zipkin span with error", () => {
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

		service.enqueue = jest.fn();

		service.makeZipkinPayloadV2(payload);

		expect(service.enqueue).toHaveBeenCalledTimes(1);
		expect(service.enqueue).toHaveBeenCalledWith({
			"id": "48be6b2f0ee64851",
			"kind": "CONSUMER",
			"name": "votes.count",
			"traceId": "60ff29915c674a1d",
			"parentId": "60ff29915c674a1d",

			"localEndpoint": {
				"serviceName": "votes"
			},
			"remoteEndpoint": {
				"serviceName": "votes"
			},

			"debug": false,
			"shared": false,

			"annotations": [
				{
					"timestamp": 1520505261078000,
					"value": "sr"
				},
				{
					"timestamp": 1520505261142436,
					"value": "ss"
				},
				{
					"endpoint": {
						"ipv4": "",
						"port": 0,
						"serviceName": "votes"
					},
					"timestamp": 1520505261142436,
					"value": "error"
				}
			],

			"tags": {
				"callerNodeID": "node-99",
				"level": "2",
				"nodeID": "node-100",
				"meta.user.name": "John",
				"remoteCall": "false",
				"error": "Something went wrong!",
				"error.code": "401",
				"error.type": "WRONG_THING",
				"error.data.a": "5",
				"error.stack": "error stack",
			},
			"timestamp": 1520505261078000,
			"durationMicros": 64436
		});
	});
});

describe("Test sending & queueing", () => {

	describe("with batching", () => {
		const broker = new ServiceBroker();
		const service = broker.createService(ZipkinService, { settings: { batchTime: 1000 }});

		beforeEach(() => broker.start());
		afterEach(() => broker.stop());

		it("should put to queue & send from queue", () => {
			service.send = jest.fn();

			expect(service.queue).toBeDefined();
			expect(service.queue.length).toBe(0);

			const payload1 = { a: 5 };

			service.enqueue(payload1);
			expect(service.queue.length).toBe(1);
			expect(service.queue[0]).toBe(payload1);

			const payload2 = { b: "John" };

			service.enqueue(payload2);
			expect(service.queue.length).toBe(2);
			expect(service.queue[1]).toBe(payload2);

			service.sendFromQueue();
			expect(service.send).toHaveBeenCalledTimes(1);
			expect(service.send).toHaveBeenCalledWith([payload1, payload2]);
			expect(service.queue.length).toBe(0);
		});
	});

	describe("without batching", () => {
		const broker = new ServiceBroker();
		const service = broker.createService(ZipkinService, { settings: { batchTime: 0 }});

		beforeEach(() => broker.start());
		afterEach(() => broker.stop());

		it("shouldn't put to queue, call send instead", () => {
			service.send = jest.fn();

			const payload1 = { a: 5 };

			service.enqueue(payload1);
			expect(service.queue.length).toBe(0);
			expect(service.send).toHaveBeenCalledTimes(1);
			expect(service.send).toHaveBeenCalledWith([payload1]);

			const payload2 = { b: "John" };

			service.send.mockClear();
			service.enqueue(payload2);
			expect(service.queue.length).toBe(0);
			expect(service.send).toHaveBeenCalledTimes(1);
			expect(service.send).toHaveBeenCalledWith([payload2]);
		});
	});

	describe("test timer", () => {
		let broker;
		let service;
		let clock;

		beforeAll(() => {
			clock = lolex.install();
			broker = new ServiceBroker();
			service = broker.createService(ZipkinService, { settings: { batchTime: 500 }});
			service.sendFromQueue = jest.fn();

			return broker.start();
		});

		afterAll(() => {
			clock.uninstall();
			return broker.stop();
		});
		it("should call sendFromQueue", () => {
			service.sendFromQueue.mockClear();

			clock.tick(550);

			expect(service.sendFromQueue).toHaveBeenCalledTimes(1);
			expect(service.sendFromQueue).toHaveBeenCalledWith();
		});

	});

	describe("Test sending", () => {
		const broker = new ServiceBroker();
		const service = broker.createService(ZipkinService, { settings: { baseURL: "http://zipkin-server:9876" }});

		beforeEach(() => broker.start());
		afterEach(() => broker.stop());

		it("should call axios.post with spans", () => {
			service.axios.post = jest.fn(() => Promise.resolve());

			const payloads = [{ a: 5 }, { b: "John" }];

			service.send(payloads);

			expect(service.axios.post).toHaveBeenCalledTimes(1);
			expect(service.axios.post).toHaveBeenCalledWith("/api/v2/spans", payloads);
		});
	});

});

