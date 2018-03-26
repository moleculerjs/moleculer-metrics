/*
 * moleculer-console-tracer
 * Copyright (c) 2018 MoleculerJS (https://github.com/moleculerjs/moleculer-addons)
 * MIT Licensed
 */

"use strict";

const _ = require("lodash");

/**
 * Simple tracer service to print metric traces to the console.
 *
 * @name moleculer-console-tracer
 * @module Service
 */
module.exports = {

	name: "console-tracer",

	/**
	 * Default settings
	 */
	settings: {
		/** @type {Number} Table width. */
		width: 80,

		/** @type {Number} Gauge width. */
		gaugeWidth: 40
	},

	/**
	 * Events
	 */
	events: {

		"metrics.trace.span.start"(payload) {
			this.requests[payload.id] = payload;
			payload.spans = [];

			if (payload.parent) {
				let parent = this.requests[payload.parent];
				if (parent)
					parent.spans.push(payload.id);
			}
		},

		"metrics.trace.span.finish"(payload) {
			let item = this.requests[payload.id];
			Object.assign(item, payload);

			if (!payload.parent) {
				this.printRequest(payload.id);

				// TODO: remove old printed requests
			}
		}
	},

	/**
	 * Methods
	 */
	methods: {
		/**
		 * Print request traces
		 *
		 * @param {String} id
		 */
		printRequest(id) {
			let main = this.requests[id];

			let w = this.settings.width || 80;
			let r = _.repeat;
			let gw = this.settings.gaugeWidth || 40;
			let maxTitle = w - 2 - 2 - gw - 2 - 1;

			this.logger.info(["┌", r("─", w-2), "┐"].join(""));


			this.logger.info(["│ ID: ", id, r(" ", w - id.length - 7), "│"].join(""));
			// TODO: add "Depth: 3, Spans: 13"
			this.logger.info(["├", r("─", w-2), "┤"].join(""));

			let printSpanTime = (span) => {
				let time = span.duration == null ? "?" : span.duration.toFixed(2);

				let maxActionName = maxTitle - (span.level-1) * 2 - time.length - 3 - (span.fromCache ? 2 : 0) - (span.remoteCall ? 2 : 0) - (span.error ? 2 : 0);
				let actionName = span.action ? span.action.name : "";
				if (actionName.length > maxActionName)
					actionName = _.truncate(span.action.name, { length: maxActionName });

				let strAction = [
					r("  ", span.level - 1),
					actionName,
					r(" ", maxActionName - actionName.length + 1),
					span.fromCache ? "* " : "",
					span.remoteCall ? "» " : "",
					span.error ? "× " : "",
					time,
					"ms "
				].join("");

				if (span.startTime == null || span.endTime == null) {
					this.logger.info("│ " + strAction + "! Missing timestamps!" + " │");
					return;
				}

				let gstart = (span.startTime - main.startTime) / (main.endTime - main.startTime) * 100;
				let gstop = (span.endTime - main.startTime) / (main.endTime - main.startTime) * 100;

				if (_.isNaN(gstart) && _.isNaN(gstop)) {
					gstart = 0;
					gstop = 100;
				}
				if (gstop > 100)
					gstop = 100;

				let p1 = Math.round(gw * gstart / 100);
				let p2 = Math.round(gw * gstop / 100) - p1;
				let p3 = Math.max(gw - (p1 + p2), 0);

				let gauge = [
					"[",
					r(".", p1),
					r("■", p2),
					r(".", p3),
					"]"
				].join("");

				this.logger.info("│ " + strAction + gauge + " │");

				if (span.spans.length > 0)
					span.spans.forEach(spanID => printSpanTime(this.requests[spanID]));
			};

			printSpanTime(main);

			this.logger.info(["└", r("─", w-2), "┘"].join(""));
		}
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {
		this.requests = {};
	}
};
