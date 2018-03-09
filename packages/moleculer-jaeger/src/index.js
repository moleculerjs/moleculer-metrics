/*
 * moleculer-jaeger
 * Copyright (c) 2018 MoleculerJS (https://github.com/moleculerjs/moleculer-addons)
 * MIT Licensed
 */

"use strict";

const Jaeger 		= require("jaeger-client");
const UDPSender 	= require("jaeger-client/dist/src/reporters/udp_sender").default;
//const Opentracing 	= require("opentracing");
const Int64 		= require("node-int64");

/**
 * Moleculer metrics module for Jaeger.
 *
 * http://jaeger.readthedocs.io/en/latest/getting_started/#all-in-one-docker-image
 *
 * Running Jaeger in Docker:
 *
 * 		docker run -d --name jaeger -p5775:5775/udp -p6831:6831/udp -p6832:6832/udp -p5778:5778 -p16686:16686 -p14268:14268 jaegertracing/all-in-one:latest
 *
 * UI: http://<docker-ip>:16686/
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
			this.logger.warn("ID: ", metric.id, " Req:", metric.requestID);
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
			const serviceName = this.getServiceName(metric);
			const tracer = this.getTracer("moleculer");

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

			const span = tracer.startSpan(this.getSpanName(metric), {
				startTime: metric.startTime,
				childOf: parentCtx,
				tags: {
					nodeID: metric.nodeID,
					level: metric.level,
					remoteCall: metric.remoteCall
				}
			});
			this.addTags(span, "service", serviceName);
			if (metric.action && metric.action.name)
				this.addTags(span, "action", metric.action.name);

			this.addTags(span, Jaeger.opentracing.Tags.SPAN_KIND, Jaeger.opentracing.Tags.SPAN_KIND_RPC_SERVER);

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
				this.addTags(span, Jaeger.opentracing.Tags.ERROR, true);
				this.addTags(span, "error.message", metric.error.message);
				this.addTags(span, "error.type", metric.error.type);
				this.addTags(span, "error.code", metric.error.code);
			}

			span.finish(metric.endTime);
		},

		/**
		 * Add tags to span
		 *
		 * @param {Object} span
		 * @param {String} key
		 * @param {any} value
		 * @param {String?} prefix
		 */
		addTags(span, key, value, prefix) {
			const name = prefix ? `${prefix}.${key}` : key;
			if (typeof value == "object") {
				Object.keys(value).forEach(k => this.addTags(span, k, value[k], name));
			} else {
				span.setTag(name, value);
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

		getTracer(serviceName) {
			if (this.tracers[serviceName])
				return this.tracers[serviceName];

			const tracer = new Jaeger.Tracer(
				serviceName,
				this.reporter,
				this.sampler,
				{ logger: this.logger }
			);
			this.tracers[serviceName] = tracer;

			return tracer;
		}
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {
		this.tracers = {};
	},

	/**
	 * Service started lifecycle event handler
	 */
	started() {
		this.sampler = new Jaeger.ConstSampler(1);
		this.reporter = new Jaeger.RemoteReporter(new UDPSender({host: "192.168.0.181", port: "6832", logger: this.logger }));
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {
		Object.keys(this.tracers).forEach(service => {
			this.tracers[service].close();
		});
	}
};
