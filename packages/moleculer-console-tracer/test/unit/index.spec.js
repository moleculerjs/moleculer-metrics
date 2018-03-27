"use strict";

const { ServiceBroker } = require("moleculer");
const TracerService = require("../../src");

describe("Test TracerService constructor", () => {
	const broker = new ServiceBroker();
	const service = broker.createService(TracerService);

	it("should be created", () => {
		expect(service).toBeDefined();
		expect(service.requests).toBeInstanceOf(Object);
	});

});

describe("Test event listener", () => {
	const broker = new ServiceBroker();
	const service = broker.createService(TracerService);
	service.printRequest = jest.fn();

	beforeAll(() => broker.start());
	afterAll(() => broker.stop());

	it("should save the payload", () => {
		const payload = { id: "1" };
		broker.emit("metrics.trace.span.start", payload);

		expect(service.requests["1"]).toBe(payload);
	});

	it("should save the payload to the parent", () => {
		const payload = { id: "2", parent: "1" };
		broker.emit("metrics.trace.span.start", payload);

		expect(service.requests["2"]).toBe(payload);
		expect(service.requests["1"].spans.length).toBe(1);
		expect(service.requests["1"].spans[0]).toBe("2");
	});

	it("should upload request", () => {
		service.printRequest.mockClear();

		const payload = { id: "2", parent: "1", duration: 50 };
		broker.emit("metrics.trace.span.finish", payload);

		expect(service.requests["2"]).toEqual({
			id: "2",
			parent: "1",
			duration: 50,
			spans: []
		});

		expect(service.printRequest).toHaveBeenCalledTimes(0);
	});

	it("should call printRequest", () => {
		service.printRequest.mockClear();

		const payload = { id: "1", duration: 20 };
		broker.emit("metrics.trace.span.finish", payload);

		expect(service.requests["1"].duration).toBe(20);

		expect(service.printRequest).toHaveBeenCalledTimes(1);
		expect(service.printRequest).toHaveBeenCalledWith("1");
	});

});

describe("Test printRequest method", () => {
	const broker = new ServiceBroker();
	const service = broker.createService(TracerService, {
		settings: {
			colors: false
		}
	});

	const output = [];
	service.logger.info = jest.fn((...args) => output.push(args.join(" ")));

	beforeAll(() => broker.start());
	afterAll(() => broker.stop());

	it("should print traces", () => {

		service.requests["1"] = {
			id: "1",
			duration: 25.40,
			action: { name: "posts.find" },
			startTime: 1000,
			endTime: 1025.4,
			level: 1,

			spans: ["2", "3"]
		};

		service.requests["2"] = {
			id: "2",
			duration: 11.80,
			action: { name: "posts.votes" },
			startTime: 1005,
			endTime: 1016.8,
			level: 2,

			spans: ["4"]
		};

		service.requests["3"] = {
			id: "3",
			duration: 2.50,
			action: { name: "posts.likes" },
			startTime: 1010,
			endTime: 1012.5,
			level: 2,
			fromCache: true,

			spans: []
		};

		service.requests["4"] = {
			id: "4",
			duration: 8.10,
			action: { name: "users.get" },
			startTime: 1008,
			endTime: 1016.1,
			level: 3,
			remoteCall: true,

			spans: []
		};

		service.printRequest("1");

		expect(output).toEqual([
			"┌──────────────────────────────────────────────────────────────────────────────┐",
			"│ ID: 1                                                      Depth: 3 Total: 4 │",
			"├──────────────────────────────────────────────────────────────────────────────┤",
			"│ posts.find                   25ms [■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■] │",
			"│   posts.votes                11ms [.......■■■■■■■■■■■■■■■■■■■..............] │",
			"│     users.get »               8ms [............■■■■■■■■■■■■■...............] │",
			"│   posts.likes *               2ms [...............■■■■.....................] │",
			"└──────────────────────────────────────────────────────────────────────────────┘"
		]);
	});

});
