![Moleculer logo](http://moleculer.services/images/banner.png)

# moleculer-jaeger [![NPM version](https://img.shields.io/npm/v/moleculer-jaeger.svg)](https://www.npmjs.com/package/moleculer-jaeger)

Moleculer metrics module for [Jaeger](https://github.com/jaegertracing/jaeger).

![Jaeger screenshot](https://user-images.githubusercontent.com/306521/37258289-cc5e1e00-2575-11e8-93df-b81a6a444188.png)

# Features
- 5 types sampler
- UDP sender

# Install

```bash
$ npm install moleculer-jaeger
```

# Usage

```js
// moleculer.config.js
module.exports = {
    // ...
    metrics: true,
    // ...
}

// services/metrics.jaeger.service.js
const JaegerService = require("moleculer-jaeger");

module.exports = {
    mixins: [JaegerService],
    settings: {
        host: "jaeger-server",
        port: 6832
    }
};
```

## Sampler configurations
More info: [http://jaeger.readthedocs.io/en/latest/client_libraries/#sampling](http://jaeger.readthedocs.io/en/latest/client_libraries/#sampling)

**Setup ConstSampler (default):**
```js
module.exports = {
    mixins: [JaegerService],
    settings: {
        host: "jaeger-server",
        port: 6832,
        
        sampler: {
            type: "Const",
            options: {
                decision: 1
            }
        }
    }
});
```

**Setup RateLimitingSampler:**
```js
module.exports = {
    mixins: [JaegerService],
    settings: {
        host: "jaeger-server",
        port: 6832,
        
        sampler: {
            type: "RateLimiting",
            options: {
                maxTracesPerSecond: 2,
                initBalance: 5
            }
        }
    }
});
```

**Setup ProbabilisticSampler:**
```js
module.exports = {
    mixins: [JaegerService],
    settings: {
        host: "jaeger-server",
        port: 6832,
        
        sampler: {
            type: "Probabilistic",
            options: {
                samplingRate: 0.1 // 10%
            }
        }
    }
});
```

**Setup GuaranteedThroughputSampler:**
>GuaranteedThroughputProbabilisticSampler is a sampler that leverages both probabilisticSampler and rateLimitingSampler. The rateLimitingSampler is used as a guaranteed lower bound sampler such that every operation is sampled at least once in a time interval defined by the lowerBound. ie a lowerBound of `1.0 / (60 * 10)` will sample an operation at least once every 10 minutes.

```js
module.exports = {
    mixins: [JaegerService],
    settings: {
        host: "jaeger-server",
        port: 6832,
        
        sampler: {
            type: "GuaranteedThroughput",
            options: {
                lowerBound: 0.1,
                samplingRate: 0.1
            }
        }
    }
});
```

**Setup RemoteControlledSampler:**
```js
module.exports = {
    mixins: [JaegerService],
    settings: {
        host: "jaeger-server",
        port: 6832,
        
        sampler: {
            type: "RemoteControlled",
            options: {
                //...
            }
        }
    }
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

<!-- AUTO-CONTENT-START:SETTINGS -->
| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `host` | `String` | **required** | UDP Sender host option. |
| `port` | `Number` | `null` | UDP Sender port option. |
| `sampler` | `Object` | `null` | Sampler configuration. |
| `sampler.type` | `String` | `null` | Sampler type |
| `sampler.options` | any | **required** |  |
| `options` | `Object` | `null` | Additional options for `Jaeger.Tracer` |

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
