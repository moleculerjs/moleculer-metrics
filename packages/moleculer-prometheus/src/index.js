/*
 * moleculer-prometheus
 * Copyright (c) 2018 MoleculerJS (https://github.com/moleculerjs/moleculer-addons)
 * MIT Licensed
 */

"use strict";

const polka = require("polka");

/**
 * Moleculer metrics module for Prometheus.
 *
 * 		https://prometheus.io/
 *
 * Running Prometheus & Grafana in Docker:
 *
 * 		git clone https://github.com/vegasbrianc/prometheus.git
 * 		cd prometheus
 *
 * 	Please note, don't forget add your endpoint to static targets in prometheus/prometheus.yml file
 *
 *     static_configs:
 *       - targets: ['localhost:9090', 'moleculer-node-123:3030']
 *
 *  Start containers:
 *
 * 		docker-compose up -d
 *
 * Grafana dashboard: http://<docker-ip>:3000
 *
 * @name moleculer-prometheus
 * @module Service
 */
module.exports = {
	name: "prometheus",

	/**
	 * Default settings
	 */
	settings: {
		/** @type {Number} Exposed HTTP port. */
		port: 3030,

		/** @type {Boolean} Enable to collect default metrics. */
		collectDefaultMetrics: true,

		/** @type {Number} Timeout option for 'collectDefaultMetrics'. */
		timeout: 10 * 1000,

		/** @type {Object} Metric definitions. */
		metrics: {
			// Common metrics
			"moleculer_nodes_total": 		{ type: "Gauge", help: "Moleculer nodes count" },
			"moleculer_services_total": 	{ type: "Gauge", help: "Moleculer services count" },
			"moleculer_actions_total": 		{ type: "Gauge", help: "Moleculer actions count" },
			"moleculer_events_total": 		{ type: "Gauge", help: "Moleculer event subscriptions" },

			// Nodes
			"moleculer_nodes": 				{ type: "Gauge", labelNames: [ "nodeID", "type", "version", "langVersion" ], help: "Moleculer node list" },

			// Actions
			"moleculer_action_endpoints_total": { type: "Gauge", labelNames: [ "action" ], help: "Moleculer action endpoints" },

			// Services
			"moleculer_service_endpoints_total": { type: "Gauge", labelNames: [ "service", "version" ], help: "Moleculer service endpoints" },

			// Events
			"moleculer_event_endpoints_total": { type: "Gauge", labelNames: [ "event", "group" ], help: "Moleculer event endpoints" },

			// Service requests
			"moleculer_req_total": 			{ type: "Counter", labelNames: [ "action", "service", "nodeID" ], help: "Moleculer action request count"},
			"moleculer_req_errors_total": 	{ type: "Counter", labelNames: [ "action", "service", "nodeID", "errorCode", "errorName", "errorType" ], help: "Moleculer request error count"},
			"moleculer_req_duration_ms": 	{ type: "Histogram", labelNames: [ "action", "service", "nodeID" ], help: "Moleculer request durations"},
		}
	},

	/**
	 * Events
	 */
	events: {
		"metrics.trace.span.finish"(payload) {
			let serviceName = this.getServiceName(payload);
			let spanName = this.getSpanName(payload);

			this.update("moleculer_req_total", "inc", { action: spanName, service: serviceName, nodeID: payload.nodeID });
			this.update("moleculer_req_duration_ms", "observe", { action: spanName, service: serviceName, nodeID: payload.nodeID }, payload.duration);

			if (payload.error) {
				this.update("moleculer_req_errors_total", "inc", {
					action: spanName,
					service: serviceName,
					nodeID: payload.nodeID,
					errorCode: payload.error.code,
					errorName: payload.error.name,
					errorType: payload.error.type ? payload.error.type : ""
				});
			}
		},

		"metrics.update"(payload) {
			this.update(payload.name, payload.method, payload.labels, payload.value, payload.timestamp);
		},

		"$services.changed"() {
			this.updateCommonValues();
		},

		"$node.connected"() {
			this.updateCommonValues();
		},

		"$node.disconnected"() {
			this.updateCommonValues();
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
		 * Create Prometheus metrics.
		 *
		 * @param {Object} metricsDefs
		 */
		createMetrics(metricsDefs) {
			this.metrics = {};
			if (!metricsDefs) return;

			Object.keys(metricsDefs).forEach(name => {
				const def = metricsDefs[name];

				if (def)
					this.metrics[name] = new this.client[def.type](Object.assign({
						name,
						registers: this.register? [this.register]:[]
					}, def));
			});
		},

		/**
		 * Update common Moleculer metric values.
		 */
		updateCommonValues() {
			if (!this.metrics) return;

			return this.broker.mcall({
				nodes: { action: "$node.list" },
				services: { action: "$node.services", params: { withActions: false, grouping: true, skipInternal: true } },
				actions: { action: "$node.actions", params: { withEndpoints: true, skipInternal: true } },
				events: { action: "$node.events", params: { withEndpoints: true, skipInternal: true } }
			}).then(({ nodes, services, actions, events}) => {

				this.update("moleculer_nodes_total", "set", null, nodes.filter(node => node.available).length);
				nodes.forEach(node => this.update("moleculer_nodes", "set", { nodeID: node.id, type: node.client.type, version: node.client.version, langVersion: node.client.langVersion }, node.available ? 1 : 0));

				this.update("moleculer_services_total", "set", null, services.length);
				services.forEach(svc => this.update("moleculer_service_endpoints_total", "set", { service: svc.name, version: svc.version }, svc.nodes.length));

				this.update("moleculer_actions_total", "set", null, actions.length);
				actions.forEach(action => this.update("moleculer_action_endpoints_total", "set", { action: action.name }, action.endpoints ? action.endpoints.length : 0));

				this.update("moleculer_events_total", "set", null, events.length);
				events.forEach(event => this.update("moleculer_event_endpoints_total", "set", { event: event.name, group: event.group }, event.endpoints ? event.endpoints.length : 0));
			});
		},

		/**
		 * Update a metric value.
		 *
		 * @methods
		 * @param {String} name
		 * @param {String} method
		 * @param {Object?} labels
		 * @param {any} value
		 * @param {any} timestamp
		 */
		update(name, method, labels, value, timestamp) {
			if (this.metrics[name]) {
				if (labels)
					this.metrics[name][method](labels, value, timestamp);
				else
					this.metrics[name][method](value, timestamp);
			}
		}
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {
		this.server = polka();
	},

	/**
	 * Service started lifecycle event handler
	 */
	started() {
		this.client = require("prom-client");
		this.register = new this.client.Registry();

		if (this.settings.collectDefaultMetrics) {
			this.timer = this.client.collectDefaultMetrics({
				timeout: this.settings.timeout,
				register: this.register
			 });
		}

		this.createMetrics(this.settings.metrics);

		this.server.get("/metrics", (req, res) => {
			res.setHeader("Content-Type", this.client.contentType);
			res.end(this.register.metrics());
		});

		return this.server.listen(this.settings.port).then(() => {
			this.logger.info(`Prometheus collector is listening on port ${this.settings.port}, metrics exposed on /metrics endpoint`);

			this.updateCommonValues();
		});
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}

		this.register = null;

		if (this.server)
			this.server.server.close();
	}
};
