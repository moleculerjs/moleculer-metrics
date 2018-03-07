/*
 * moleculer-zipkin
 * Copyright (c) 2018 MoleculerJS (https://github.com/moleculerjs/moleculer-addons)
 * MIT Licensed
 */

"use strict";

let axios = require("axios");

/**
 * Zipkin tracing addons.
 *
 * Running Zipkin in Docker:
 *
 * 	 docker run -d -p 9411:9411 --name=zipkin openzipkin/zipkin
 *
 * @name moleculer-zipkin
 * @module Service
 */
module.exports = {
	name: "zipkin",

	/**
	 * Default settings
	 */
	settings: {
		baseURL: "http://localhost:9411"
	},

	/**
	 * Events
	 */
	events: {
		// V2
		"metrics.trace.span.finish"(metric) {
			//this.logger.info("Metric finish", metric);

			let parts = metric.action.name.split(".");
			parts.pop();
			let serviceName = parts.join(".");

			const payload = {
				name: metric.action.name,
				kind: "CLIENT",

				// Trace & span IDs
				traceId: this.convertID(metric.requestID),
				id: this.convertID(metric.id),
				parentId: this.convertID(metric.parent),

				localEndpoint: {
					serviceName: serviceName,
					ipv4: "",
					port: 0
				},

				remoteEndpoint: {
					serviceName: serviceName,
					ipv4: "",
					port: 0
				},

				annotations: [
					{ timestamp: this.convertTime(metric.startTime), value: "sr" },
					{ timestamp: this.convertTime(metric.endTime), value: "ss" },
				],

				// Tags
				tags: {
					nodeID: metric.nodeID,
					level: metric.level.toString(),
					remoteCall: metric.remoteCall.toString(),
					callerNodeID: metric.callerNodeID ? metric.callerNodeID : ""
				},

				timestamp: this.convertTime(metric.startTime),
				durationMicros: Math.round(metric.duration * 1000),

				debug: true
			};

			if (metric.params)
				this.addTags(payload, "params", metric.params);

			if (metric.meta)
				this.addTags(payload, "meta", metric.meta);

			if (metric.error) {
				this.addTags(payload, "error", metric.error.message);
				this.addTags(payload, "errorType", metric.error.type);
				this.addTags(payload, "errorCode", metric.error.code);

				payload.annotations.push({
					value: "error",
					endpoint: { serviceName: serviceName, ipv4: "", port: 0 },
					timestamp: this.convertTime(metric.endTime)
				});
			}

			if (this.settings.baseURL) {
				axios.post(`${this.settings.baseURL}/api/v2/spans`, [payload])
					.then(() => this.logger.debug(`Span '${payload.id}' sent. Trace ID: ${payload.traceId}`))
					.catch(err => this.logger.warn("Span sending error!", err.response.data));
			}
		},

		/* V1
		"metrics.trace.span.finish"(metric) {
			//this.logger.info("Metric finish", metric);

			let parts = metric.action.name.split(".");
			parts.pop();
			let serviceName = parts.join(".");

			const payload = {
				name: metric.action.name,

				// Trace & span IDs
				traceId: this.convertID(metric.requestID),
				id: this.convertID(metric.id),
				parentId: this.convertID(metric.parent),

				// Annotations
				annotations: [
					{
						endpoint: { serviceName: serviceName, ipv4: "", port: 0 },
						timestamp: this.convertTime(metric.startTime),
						value: "sr"
					},
					{
						endpoint: { serviceName: serviceName, ipv4: "", port: 0 },
						timestamp: this.convertTime(metric.endTime),
						value: "ss"
					}
				],

				// Binary annotations
				binaryAnnotations: [
					{ key: "nodeID", 		value: metric.nodeID },
					{ key: "level", 		value: metric.level.toString() },
					{ key: "remoteCall", 	value: metric.remoteCall.toString() },
					{ key: "callerNodeID", 	value: metric.callerNodeID ? metric.callerNodeID : "" }
				],

				timestamp: this.convertTime(metric.endTime)
			};

			if (metric.params)
				this.addBinaryAnnotation(payload, "params", metric.params);

			if (metric.meta)
				this.addBinaryAnnotation(payload, "meta", metric.meta);

			if (metric.error) {
				this.addBinaryAnnotation(payload, "error", metric.error.message);
				this.addBinaryAnnotation(payload, "errorType", metric.error.type);
				this.addBinaryAnnotation(payload, "errorCode", metric.error.code);

				payload.annotations.push({
					value: "error",
					endpoint: { serviceName: serviceName, ipv4: "", port: 0 },
					timestamp: this.convertTime(metric.endTime)
				});
			}

			if (this.settings.baseURL) {
				axios.post(`${this.settings.baseURL}/api/v1/spans`, [payload])
					.then(() => this.logger.debug(`Span '${payload.id}' sent. Trace ID: ${payload.traceId}`))
					.catch(err => this.logger.warn("Span sending error!", err.response.data));
			}
		}*/
	},

	/**
	 * Methods
	 */
	methods: {
		/**
		 * Add binary annotation to the payload
		 *
		 * @param {Object} payload
		 * @param {String} key
		 * @param {any} value
		 */
		addBinaryAnnotation(payload, key, value) {
			if (typeof value == "object") {
				payload.binaryAnnotations.push({
					key,
					value: JSON.stringify(value)
				});
			} else {
				payload.binaryAnnotations.push({
					key,
					value: String(value)
				});
			}
		},

		addTags(payload, key, value) {
			if (typeof value == "object") {
				payload.tags[key] = JSON.stringify(value);
			} else {
				payload.tags[key] = String(value);
			}
		},

		/**
		 * Convert Context ID to Zipkin format
		 *
		 * @param {String} id
		 * @returns {String}
		 */
		convertID(id) {
			return id ? id.replace(/-/g, "").substring(0,16) : "";
		},

		/**
		 * Convert JS timestamp to microseconds
		 *
		 * @param {Number} ts
		 * @returns {Number}
		 */
		convertTime(ts) {
			return Math.round(ts * 1000);
		},
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {
		if (!this.settings.baseURL) {
			this.logger.warn("The 'baseURL' is not defined in service settings. Tracing DISABLED!");
		}
	},

	/**
	 * Service started lifecycle event handler
	 */
	started() {

	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {

	}
};
