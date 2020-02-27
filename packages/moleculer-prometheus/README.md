![Moleculer logo](http://moleculer.services/images/banner.png)

# moleculer-prometheus [![NPM version](https://img.shields.io/npm/v/moleculer-prometheus.svg)](https://www.npmjs.com/package/moleculer-prometheus)

Moleculer metrics module for [Prometheus](https://prometheus.io/).

![Grafana screenshot](https://user-images.githubusercontent.com/306521/37919389-ff994100-3123-11e8-9da9-b771978e635f.png)

# Features
- collect default Node.js metrics.
- measure service calls.
- support custom metrics.
- Grafana [dashboard example](grafana-dashboards/).

# Install

```bash
$ npm install moleculer-prometheus
```

# Usage

```js
// services/metrics.prometheus.service.js

const PromService = require("moleculer-prometheus");

module.exports = {
    mixins: [PromService],
    settings: {
        port: 3030,
        collectDefaultMetrics: true,
        timeout: 5 * 1000, 
    }
};

// moleculer.config.js
module.exports = {
    // ...
    metrics: true,
    // ...
}
```

### Add custom metric

```js
// services/metrics.prometheus.js
const PromService = require("moleculer-prometheus");

module.exports = {
    mixins: [PromService],
    settings: {
        metrics: {
           "custom_value": { type: "Gauge", help: "Moleculer Prometheus custom metric" } 
        } 
    }
};
```

**Broadcast a `metrics.update` event to set the metric value**
```js
broker.broadcast("metrics.update", {
    name: "custom_value",
    method: "set",
    value: Math.round(Math.random() * 100)
});
```



<!-- AUTO-CONTENT-START:USAGE -->
<!-- AUTO-CONTENT-END:USAGE -->

<!-- AUTO-CONTENT-TEMPLATE:USAGE
{{#hasExamples}}
{{#each examples}}
{{{this}}}
{{/each}}
{{/hasExamples}}
-->



# Settings

| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `port` | `Number` | `3030` | Exposed HTTP port. |
| `collectDefaultMetrics` | `Boolean` | `true` | Enable to collect default metrics. |
| `timeout` | `Number` | `10000` | Timeout option for 'collectDefaultMetrics' in milliseconds. |
| `metrics` | `Object` | `{}` | Metric definitions. |

# Default Moleculer metrics

| Name | Type | Labels | Description |
| ---- | ---- | ------ | ----------- |
| `moleculer_nodes_total` | Gauge | - | Moleculer nodes count |
| `moleculer_services_total` | Gauge | - | Moleculer services count |
| `moleculer_actions_total` | Gauge | - | Moleculer actions count |
| `moleculer_events_total` | Gauge | - | Moleculer event subscription count |
| `moleculer_nodes` | Gauge | `nodeID`, `type`, `version`, `langVersion` | Moleculer node list |
| `moleculer_action_endpoints_total` | Gauge | `action` | Moleculer action endpoints |
| `moleculer_service_endpoints_total` | Gauge | `service`, `version` | Moleculer service endpoints |
| `moleculer_event_endpoints_total` | Gauge | `event`, `group` | Moleculer event endpoints |
| `moleculer_req_total` | Counter | `action`, `service`, `nodeID` | Moleculer request count |
| `moleculer_req_errors_total` | Counter | `action`, `service`, `nodeID`, `errorCode`, `errorName`, `errorType` | Moleculer request error count |
| `moleculer_req_duration_ms` | Histogram | `action`, `service`, `nodeID` | Moleculer request durations |


# Methods

<!-- AUTO-CONTENT-START:METHODS -->
## `update` 

Update a metric value.

### Parameters
| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `name` | `String` | **required** |  |
| `method` | `String` | **required** |  |
| `labels` | `Object` | - |  |
| `value` | `any` | **required** |  |
| `timestamp` | `any` | **required** |  |



<!-- AUTO-CONTENT-END:METHODS -->

<!-- AUTO-CONTENT-TEMPLATE:METHODS
{{#each this}}
## `{{name}}` {{#each badges}}{{this}} {{/each}}
{{#since}}
_<sup>Since: {{this}}</sup>_
{{/since}}

{{description}}

### Parameters
| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
{{#each params}}
| `{{name}}` | {{type}} | {{defaultValue}} | {{description}} |
{{/each}}
{{^params}}
*No input parameters.*
{{/params}}

{{#returns}}
### Results
**Type:** {{type}}

{{description}}
{{/returns}}

{{#hasExamples}}
### Examples
{{#each examples}}
{{this}}
{{/each}}
{{/hasExamples}}

{{/each}}
-->

# Test
```
$ npm test
```

In development with watching

```
$ npm run ci
```

# License
The project is available under the [MIT license](https://tldrlegal.com/license/mit-license).

# Contact
Copyright (c) 2016-2018 MoleculerJS

[![@moleculerjs](https://img.shields.io/badge/github-moleculerjs-green.svg)](https://github.com/moleculerjs) [![@MoleculerJS](https://img.shields.io/badge/twitter-MoleculerJS-blue.svg)](https://twitter.com/MoleculerJS)
