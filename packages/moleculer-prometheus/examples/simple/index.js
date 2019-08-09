"use strict";

const { ServiceBroker } 	= require("moleculer");
const { MoleculerError } 	= require("moleculer").Errors;
const PromService 			= require("../../index");

// Create broker
const broker = new ServiceBroker({
	logger: console,
	logLevel: "info",
	metrics: true,
	sampleCount: 1
});

// Load Prometheus service
broker.createService({
	mixins: [PromService],
	settings: {
		metrics: {
			"custom_value": { type: "Gauge", help: "Moleculer Prometheus custom metric" },
		}
	}
});

broker.createService({
	name: "posts",
	actions: {
		find: {
			handler() {
				if (Math.random() > 0.95)
					return this.Promise.reject(new MoleculerError("Something went wrong"));

				return this.Promise.resolve([]).delay(Math.round(Math.random() * 200));
			}
		}
	}
});

// Start server
broker.start().then(() => {
	broker.repl();

	setInterval(() => {
		// Call action
		broker.call("posts.find")
			.then(() => broker.logger.info("Request done."))
			.catch(err => broker.logger.info("Request error: ", err.message));
	}, 100);

	setInterval(() => {
		broker.broadcast("metrics.update", {
			name: "custom_value",
			method: "set",
			value: Math.round(Math.random() * 100)
		});
	}, 1000);
});
