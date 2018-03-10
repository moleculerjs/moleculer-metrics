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
 * API v2: https://zipkin.io/zipkin-api/#/
 * API v1: https://zipkin.io/pages/data_model.html
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
		/** @type {String} Base URL for Zipkin server. */
		baseURL: "http://localhost:9411",

		/** @type {String} Zipkin REST API version. */
		version: "v2",

		/** @type {Number} Batch send time interal. Disable: 0 */
		batchTime: 1000,

		/** @type {Object} Additional payload options. */
		payloadOptions: {

			/** @type {Boolean} Set `debug` property in v2 payload. */
			debug: false,

			/** @type {Boolean} Set `shared` property in v2 payload. */
			shared: false
		}
	},

	/**
	 * Events
	 */
	events: {
		"metrics.trace.span.finish"(metric) {
			if (this.settings.version == "v2") {
				this.makeZipkinPayloadV2(metric);
			} else {
				this.makeZipkinPayloadV1(metric);
			}
		}
	},

	/**
	 * Methods
	 */
	methods: {
		/**
		 * Get service name from metric event
		 *
		 * @param {Object} metric
		 * @returns {String}
		 */
		getServiceName(metric) {
			if (metric.service)
				return metric.service;

			let parts = metric.action.name.split(".");
			parts.pop();
			return parts.join(".");
		},

		/**
		 * Get span name from metric event. By default it returns the action name
		 *
		 * @param {Object} metric
		 * @returns  {String}
		 */
		getSpanName(metric) {
			if (metric.name)
				return metric.name;

			return metric.action.name;
		},

		/**
		 * Create Zipkin v1 payload from metric event
		 *
		 * @param {Object} metric
		 */
		makeZipkinPayloadV1(metric) {
			const serviceName = this.getServiceName(metric);

			const payload = {
				name: this.getSpanName(metric),

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
				this.addBinaryAnnotation(payload, "error.type", metric.error.type);
				this.addBinaryAnnotation(payload, "error.code", metric.error.code);

				if (metric.error.data)
					this.addBinaryAnnotation(payload, "error.data", metric.error.data);

				if (metric.error.stack)
					this.addBinaryAnnotation(payload, "error.stack", metric.error.stack.toString());

				payload.annotations.push({
					value: "error",
					endpoint: { serviceName: serviceName, ipv4: "", port: 0 },
					timestamp: this.convertTime(metric.endTime)
				});
			}

			this.enqueue(payload);
		},

		/**
		 * Create Zipkin v2 payload from metric event
		 *
		 * @param {Object} metric
		 */
		makeZipkinPayloadV2(metric) {
			const serviceName = this.getServiceName(metric);

			const payload = {
				name: this.getSpanName(metric),
				kind: "CONSUMER",

				// Trace & span IDs
				traceId: this.convertID(metric.requestID),
				id: this.convertID(metric.id),
				parentId: this.convertID(metric.parent),

				localEndpoint: {
					serviceName: serviceName,
				},

				remoteEndpoint: {
					serviceName: serviceName,
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

				debug: this.settings.payloadOptions.debug,
				shared: this.settings.payloadOptions.shared
			};

			if (metric.params)
				this.addTags(payload, "params", metric.params);

			if (metric.meta)
				this.addTags(payload, "meta", metric.meta);

			if (metric.error) {
				this.addTags(payload, "error", metric.error.message);
				this.addTags(payload, "error.type", metric.error.type);
				this.addTags(payload, "error.code", metric.error.code);

				if (metric.error.data)
					this.addTags(payload, "error.data", metric.error.data);

				if (metric.error.stack)
					this.addTags(payload, "error.stack", metric.error.stack.toString());


				payload.annotations.push({
					value: "error",
					endpoint: { serviceName: serviceName, ipv4: "", port: 0 },
					timestamp: this.convertTime(metric.endTime)
				});
			}

			this.enqueue(payload);
		},

		/**
		 * Enqueue the span payload
		 *
		 * @param {Object} payload
		 */
		enqueue(payload) {
			if (this.settings.batchTime > 0) {
				this.queue.push(payload);
			} else {
				this.send([payload]);
			}
		},

		/**
		 * Send all spans from the queue.
		 *
		 */
		sendFromQueue() {
			if (this.queue.length > 0) {
				const payloads = this.queue;
				this.send(payloads);
				this.queue = [];
			}
		},

		/**
		 * Send multiple payloads to Zipkin server
		 *
		 * @param {Array<Object>} payloads
		 */
		send(payloads) {
			if (this.settings.baseURL) {
				this.axios.post(`/api/${this.settings.version}/spans`, payloads)
					.then(() => this.logger.debug(`${payloads.length} span(s) sent.`))
					.catch(err => {
						/* istanbul ignore next */
						const message = err.response ? err.response.data : err.message;
						/* istanbul ignore next */
						this.logger.debug("Span sending error!", message, payloads);
					});
			}
		},

		/**
		 * Add binary annotation to v1 payload
		 *
		 * @param {Object} payload
		 * @param {String} key
		 * @param {any} value
		 * @param {String?} prefix
		 */
		addBinaryAnnotation(payload, key, value, prefix) {
			const name = prefix ? (prefix + "." + key) : key;
			if (typeof value == "object") {
				Object.keys(value).forEach(k => this.addBinaryAnnotation(payload, k, value[k], name));
			} else {
				payload.binaryAnnotations.push({
					key: name,
					value: String(value)
				});
			}
		},

		/**
		 * Add tags to v2 payload
		 *
		 * @param {Object} payload
		 * @param {String} key
		 * @param {any} value
		 * @param {String?} prefix
		 */
		addTags(payload, key, value, prefix) {
			const name = prefix ? `${prefix}.${key}` : key;
			if (typeof value == "object") {
				Object.keys(value).forEach(k => this.addTags(payload, k, value[k], name));
			} else {
				payload.tags[name] = String(value);
			}
		},

		/**
		 * Convert Context ID to Zipkin format
		 *
		 * @param {String} id
		 * @returns {String}
		 */
		convertID(id) {
			return id ? id.replace(/-/g, "").substring(0,16) : null;
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
		/* istanbul ignore next */
		if (!this.settings.baseURL) {
			this.logger.warn("The 'baseURL' is not defined in service settings. Tracing is DISABLED!");
		}

		this.queue = [];

		this.axios = axios.create({
			baseURL: this.settings.baseURL,
			headers: {
				post: {
					"Content-Type": "application/json"
				}
			}
		});
	},

	/**
	 * Service started lifecycle event handler
	 */
	started() {
		if (this.settings.batchTime > 0) {
			this.timer = setInterval(() => this.sendFromQueue(), this.settings.batchTime);
		}
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {
		if (this.timer) {
			if (this.queue.length > 0)
				this.sendFromQueue();

			clearInterval(this.timer);
			this.timer = null;
		}
	}
};
