![Moleculer logo](http://moleculer.services/images/banner.png)

# moleculer-zipkin [![NPM version](https://img.shields.io/npm/v/moleculer-zipkin.svg)](https://www.npmjs.com/package/moleculer-zipkin)

Moleculer metrics module for [Zipkin](https://zipkin.io/).

![Zipkin screenshot](https://user-images.githubusercontent.com/306521/37258287-ca6f8fac-2575-11e8-80b8-446a0423895c.png)

# Features
- support `v1` & `v2` API.
- send spans via HTTP.
- batch or single sending.

# Install

```bash
$ npm install moleculer-zipkin
```

# Usage

```js
// services/metrics.zipkin.js

const ZipkinService = require("moleculer-zipkin");

module.exports = {
    mixins: [ZipkinService],
    settings: {
        baseURL: "http://192.168.0.181:9411",
        version: "v2",
        batchTime: 1000,
        payloadOptions: {
            debug: false,
            shared: false
        }
    }
});

// moleculer.config.js
module.exports = {
    // ...
    metrics: true,
    // ...
}
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

<!-- AUTO-CONTENT-START:SETTINGS -->
| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `baseURL` | `String` | **required** | Base URL for Zipkin server. |
| `version` | `String` | **required** | Zipkin REST API version. |
| `batchTime` | `Number` | **required** | Batch send time interal. Disable: 0 |
| `payloadOptions` | `Object` | **required** | Additional payload options. |
| `payloadOptions.debug` | `Boolean` | **required** | Set `debug` property in v2 payload. |
| `payloadOptions.shared` | `Boolean` | **required** | Set `shared` property in v2 payload. |

<!-- AUTO-CONTENT-END:SETTINGS -->

<!-- AUTO-CONTENT-TEMPLATE:SETTINGS
| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
{{#each this}}
| `{{name}}` | {{type}} | {{defaultValue}} | {{description}} |
{{/each}}
{{^this}}
*No settings.*
{{/this}}

-->

# Actions
<!-- AUTO-CONTENT-START:ACTIONS -->
<!-- AUTO-CONTENT-END:ACTIONS -->

<!-- AUTO-CONTENT-TEMPLATE:ACTIONS
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

# Methods

<!-- AUTO-CONTENT-START:METHODS -->
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
