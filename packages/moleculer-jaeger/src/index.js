/*
 * moleculer-jaeger
 * Copyright (c) 2018 MoleculerJS (https://github.com/moleculerjs/moleculer-addons)
 * MIT Licensed
 */

"use strict";

const Jaeger 		= require("jaeger-client");
const UDPSender 	= require("jaeger-client/dist/src/reporters/udp_sender").default;
const LoggingReporter 	= require("jaeger-client/dist/src/reporters/logging_reporter").default;
const Opentracing 	= require("opentracing");
const Int64 = require('node-int64');

/**
 * Moleculer metrics module for Jaeger.
 *
 * http://jaeger.readthedocs.io/en/latest/getting_started/#all-in-one-docker-image
 *
 * Running Jaeger in Docker:
 *
 * 	docker run -d --name jaeger -p5775:5775/udp -p6831:6831/udp -p6832:6832/udp -p5778:5778 -p16686:16686 -p14268:14268 jaegertracing/all-in-one:latest
 *
 * 	UI: http://192.168.51.29:16686/
 *
 *
 * @name moleculer-jaeger
 * @module Service
 */
module.exports = {
	name: "jaeger",

	/**
	 * Default settings
	 */
	settings: {
	},

	/**
	 * Events
	 */
	events: {
		"metrics.trace.span.finish"(metric) {
			this.logger.warn("ID: ", metric.id, " Req:", metric.requestID)
			this.makePayload(metric);
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
		 * Create Jaeger payload from metric event
		 *
		 * @param {Object} metric
		 */
		makePayload(metric) {
			//const serviceName = this.getServiceName(metric);

			let parentCtx;
			if (metric.parent) {
				parentCtx = new Jaeger.SpanContext(
					this.convertID(metric.requestID), // traceId,
					this.convertID(metric.parent), // spanId,
					null, // parentId,
					null, // traceIdStr
					null, // spanIdStr
					null, // parentIdStr
					1, // flags
					{}, // baggage
					"" // debugId
				);
			}

			const span = this.tracer.startSpan(this.getSpanName(metric), {
				startTime: metric.startTime,
				childOf: parentCtx,
				tags: {
					nodeID: metric.nodeID,
					level: metric.level,
					remoteCall: metric.remoteCall
				}
			});
			//span.serviceName = serviceName;

			const sc = span.context();
			sc.traceId = this.convertID(metric.requestID);
			sc.spanId = this.convertID(metric.id);

			if (metric.callerNodeID)
				this.addTags(span, "callerNodeID", metric.callerNodeID);

			if (metric.params)
				this.addTags(span, "params", metric.params);

			if (metric.meta)
				this.addTags(span, "meta", metric.meta);

			if (metric.error) {
				span.setTag(Opentracing.Tags.ERROR, true);
				this.addTags(span, "error.message", metric.error.message);
				this.addTags(span, "error.type", metric.error.type);
				this.addTags(span, "error.code", metric.error.code);
			}

			span.finish(metric.endTime);

			/*
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

				payload.annotations.push({
					value: "error",
					endpoint: { serviceName: serviceName, ipv4: "", port: 0 },
					timestamp: this.convertTime(metric.endTime)
				});
			}*/
		},

		/**
		 * Add tags to span
		 *
		 * @param {Object} span
		 * @param {String} key
		 * @param {any} value
		 */
		addTags(span, key, value) {
			if (typeof value == "object") {
				span.setTag(key, JSON.stringify(value));
			} else {
				span.setTag(key, value);
			}
		},

		/**
		 * Convert Context ID to Zipkin format
		 *
		 * @param {String} id
		 * @returns {String}
		 */
		convertID(id) {
			if (id) {
				return new Int64(id.replace(/-/g, "").substring(0,16)).toBuffer();
			}
			return null;
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
		// if (!this.settings.baseURL) {
		// 	this.logger.warn("The 'baseURL' is not defined in service settings. Tracing is DISABLED!");
		// }
	},

	/**
	 * Service started lifecycle event handler
	 */
	started() {
		// if (this.settings.batchTime > 0) {
		// 	this.timer = setInterval(() => this.sendFromQueue(), this.settings.batchTime);
		// }

		const sampler = new Jaeger.ConstSampler(1);
		//const reporter = new Jaeger.LoggingReporter();
		const reporter = new Jaeger.RemoteReporter(new UDPSender({host: "192.168.0.181", port: "6832", logger: this.logger }));
		this.tracer = new Jaeger.Tracer(
			"moleculer",
			reporter,
			sampler,
			{ logger: this.logger }
		);
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {
		// if (this.timer) {
		// 	if (this.queue.length > 0)
		// 		this.sendFromQueue();

		// 	clearInterval(this.timer);
		// 	this.timer = null;
		// }
	}
};
