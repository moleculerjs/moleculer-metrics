/*
 * moleculer-jaeger
 * Copyright (c) 2018 MoleculerJS (https://github.com/moleculerjs/moleculer-addons)
 * MIT Licensed
 */

"use strict";

const isFunction = require("lodash.isfunction");
const Jaeger = require("jaeger-client");
const GuaranteedThroughputSampler = require("jaeger-client/dist/src/samplers/guaranteed_throughput_sampler").default;
const RemoteControlledSampler = require("jaeger-client/dist/src/samplers/remote_sampler").default;
const UDPSender = require("jaeger-client/dist/src/reporters/udp_sender").default;

const Int64 = require("node-int64");

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
		/** @type {String} UDP Sender host option. */
		host: "127.0.0.1",
		/** @type {Number?} UDP Sender port option. */
		port: 6832,

		/** @type {Object?} Sampler configuration. */
		sampler: {
			/** @type {String?} Sampler type */
			type: "Const",

			/** @type: {Object?} Sampler specific options. */
			options: {
			}
		},

		/** @type {Object?} Additional options for `Jaeger.Tracer` */
		options: {}
	},

	/**
	 * Events
	 */
	events: {
		"metrics.trace.span.finish"(metric) {
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
				return metric.service.name ? metric.service.name : metric.service;

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

			if (metric.action)
				return metric.action.name;
		},

		/**
		 * Create Jaeger payload from metric event
		 *
		 * @param {Object} metric
		 */
		makePayload(metric) {
			const serviceName = this.getServiceName(metric);
			const tracer = this.getTracer(serviceName);

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

				if (metric.error.data)
					this.addTags(span, "error.data", metric.error.data);

				if (metric.error.stack)
					this.addTags(span, "error.stack", metric.error.stack.toString());
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
			if (value && typeof value == "object") {
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
				return new Int64(id.replace(/-/g, "").substring(0, 16)).toBuffer();
			}
			return null;
		},

		/**
		 * Get sampler instance for Tracer
		 *
		 */
		getSampler(serviceName) {
			if (isFunction(this.settings.sampler))
				return this.settings.sampler;

			if (this.settings.sampler.type == "RateLimiting")
				return new Jaeger.RateLimitingSampler(this.settings.sampler.options.maxTracesPerSecond, this.settings.sampler.options.initBalance);

			if (this.settings.sampler.type == "Probabilistic")
				return new Jaeger.ProbabilisticSampler(this.settings.sampler.options.samplingRate);

			if (this.settings.sampler.type == "GuaranteedThroughput")
				return new GuaranteedThroughputSampler(this.settings.sampler.options.lowerBound, this.settings.sampler.options.samplingRate);

			if (this.settings.sampler.type == "RemoteControlled")
				return new RemoteControlledSampler(serviceName, this.settings.sampler.options);

			return new Jaeger.ConstSampler(this.settings.sampler.options && this.settings.sampler.options.decision != null ? this.settings.sampler.options.decision : 1);
		},

		/**
		 * Get reporter instance for Tracer
		 *
		 */
		getReporter() {
			return new Jaeger.RemoteReporter(new UDPSender({ host: this.settings.host, port: this.settings.port }));
		},

		/**
		 * Get a tracer instance by service name
		 *
		 * @param {any} serviceName
		 * @returns {Jaeger.Tracer}
		 */
		getTracer(serviceName) {
			if (this.tracers[serviceName])
				return this.tracers[serviceName];

			const sampler = this.getSampler();
			const reporter = this.getReporter();

			const tracer = new Jaeger.Tracer(serviceName, reporter, sampler, this.settings.options);
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

	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {
		Object.keys(this.tracers).forEach(service => {
			this.tracers[service].close();
		});
		this.tracers = {};
	}
};
