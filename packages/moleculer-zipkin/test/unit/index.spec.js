"use strict";

const { ServiceBroker } = require("moleculer");
const ZipkinService = require("../../src");

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

		it("should start timer", () => {
			expect(service).toBeDefined();
			expect(service.timer).toBeUndefined();

			return broker.stop();
		});

	});

});

