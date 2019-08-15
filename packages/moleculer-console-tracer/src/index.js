/* eslint-disable security/detect-unsafe-regex */
/*
 * moleculer-console-tracer
 * Copyright (c) 2018 MoleculerJS (https://github.com/moleculerjs/moleculer-addons)
 * MIT Licensed
 */

"use strict";

const isNaN 			= require("lodash.isnan");
const r 			= require("lodash.repeat");
const chalk 		= require("chalk");
const humanize 		= require("tiny-human-time").short;
const slice 		= require("slice-ansi");

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
		gaugeWidth: 40,

		/** @type {Boolean} Enable colors. */
		colors: true
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

		drawTableTop() {
			return chalk.grey("┌" + r("─", this.settings.width - 2) + "┐");
		},

		drawHorizonalLine() {
			return chalk.grey("├" + r("─", this.settings.width - 2) + "┤");
		},

		drawLine(text) {
			return chalk.grey("│ ") + text + chalk.grey(" │");
		},

		drawTableBottom() {
			return chalk.grey("└" + r("─", this.settings.width - 2) + "┘");
		},

		drawAlignedTexts(leftStr, rightStr, width) {
			const ll = leftStr.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "").length;
			const rl = rightStr.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "").length;

			const space = width - rl;

			let left;
			if (ll <= space)
				left = leftStr + r(" ", space - ll);
			else {
				left = slice(leftStr, 0, Math.max(space - 3, 0));
				left += r(".", Math.min(3, space));
			}

			return left + rightStr;
		},

		drawGauge(gstart, gstop) {
			const gw = this.settings.gaugeWidth;
			const p1 = Math.floor(gw * gstart / 100);
			const p2 = Math.max(Math.floor(gw * gstop / 100) - p1, 1);
			const p3 = Math.max(gw - (p1 + p2), 0);

			return [
				chalk.grey("["),
				chalk.grey(r(".", p1)),
				r("■", p2),
				chalk.grey(r(".", p3)),
				chalk.grey("]")
			].join("");
		},

		getCaption(span) {
			let caption = this.getSpanName(span);

			if (span.fromCache)
				caption += " *";
			if (span.remoteCall)
				caption += " »";
			if (span.error)
				caption += " ×";

			return caption;
		},

		getColor(span) {
			let c = chalk.bold;
			if (span.fromCache)
				c = chalk.yellow;
			if (span.remoteCall)
				c = chalk.cyan;
			if (span.duration == null)
				c = chalk.grey;
			if (span.error)
				c = chalk.red.bold;

			return c;
		},

		getTraceInfo(main) {
			let depth = 0;
			let total = 0;
			let check = (span, level) => {
				total++;
				if (level > depth)
					depth = level;

				if (span.spans.length > 0)
					span.spans.forEach(spanID => check(this.requests[spanID], level + 1));
			};

			check(main, 1);

			return { depth, total };
		},

		/**
		 * Print a span row
		 *
		 * @param {Object} span
		 * @param {Object} main
		 */
		printSpanTime(span, main, level) {
			const margin = 2 * 2;
			const w = (this.settings.width || 80) - margin;
			const gw = this.settings.gaugeWidth || 40;

			const time = span.duration == null ? "?" : humanize(span.duration);
			const caption = r("  ", level - 1) + this.getCaption(span);
			const info = this.drawAlignedTexts(caption, " " + time, w - gw - 3);

			const startTime = span.startTime || main.startTime;
			const endTime = span.endTime || main.endTime;

			let gstart = (startTime - main.startTime) / (main.endTime - main.startTime) * 100;
			let gstop = (endTime - main.startTime) / (main.endTime - main.startTime) * 100;

			if (isNaN(gstart) && isNaN(gstop)) {
				gstart = 0;
				gstop = 100;
			}
			if (gstop > 100)
				gstop = 100;

			const c = this.getColor(span);
			this.logger.info(this.drawLine(c(info + " " + this.drawGauge(gstart, gstop))));

			if (span.spans.length > 0)
				span.spans.forEach(spanID => this.printSpanTime(this.requests[spanID], main, level + 1));
		},

		/**
		 * Print request traces
		 *
		 * @param {String} id
		 */
		printRequest(id) {
			const main = this.requests[id];
			const margin = 2 * 2;
			const w = (this.settings.width || 80) - margin;

			this.logger.info(this.drawTableTop());

			const { total, depth } = this.getTraceInfo(main);

			const headerLeft = chalk.grey("ID: ") + chalk.bold(id);
			const headerRight = chalk.grey("Depth: ") + chalk.bold(depth) + " " + chalk.grey("Total: ") + chalk.bold(total);
			const line = this.drawAlignedTexts(headerLeft, " " + headerRight, w);
			this.logger.info(this.drawLine(line));

			this.logger.info(this.drawHorizonalLine());

			this.printSpanTime(main, main, 1);

			this.logger.info(this.drawTableBottom());
		},
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {
		this.requests = {};

		chalk.enabled = this.settings.colors;
	}
};
