'use strict';

//dependencies
var kue = require('kue');
var redis = kue.redis;
var _ = require('lodash');
var async = require('async');

/**
 * @description A job scheduling utility for kue
 * @param {Object} options configuration options, similar to kue configuration
 *                         options
 */
function KueScheduler(options) {
    //extend default configurations
    //with custom provided configurations
    //and reference them for later use
    this.options = _.extend({
        redis: {
            port: 6379,
            host: '127.0.0.1'
        }
    }, options || {});

    //stup kue queue for scheduler
    //which will also do all plumbing work 
    //on setup job redis client
    this.queue = kue.createQueue(this.options);

    //a redis client for scheduling key expiry
    this.scheduler = redis.createClientFactory(this.options);

    //a redis client to listen for key expiry 
    this.listener = redis.createClientFactory(this.options);

}

KueScheduler.prototype.every = function( /*interval, jobDefinition*/ ) {
    // body...
};


KueScheduler.prototype.schedule = function( /*schedule, jobDefinition*/ ) {
    // body...
};

KueScheduler.prototype.at = function( /*time, jobDefinition*/ ) {
    // body...
};

KueScheduler.prototype.now = function( /*jobDefinition*/ ) {
    // body...
};

/**
 * @description build a kue job from a job definition
 * @param  {Object} jobDefinition valid kue job attributes
 * @param {Function} done a callback to invoke on eroro or success
 */
KueScheduler.prototype._buildJob = function(jobDefinition, done) {
    async
        .parallel({
                isDefined: function(next) {
                    //is job definition provided
                    var isObject = _.isPlainObject(jobDefinition);
                    if (!isObject) {
                        next(new Error('Invalid job definition'));
                    } else {
                        next(null, true);
                    }
                },
                isValid: function(next) {
                    //check must job attributes
                    var isValidJob = _.has(jobDefinition, 'type') &&
                        (
                            _.has(jobDefinition, 'data') &&
                            _.isPlainObject(jobDefinition.data)
                        );

                    if (!isValidJob) {
                        next(new Error('Missing job type or data'));
                    } else {
                        next(null, true);
                    }
                }
            },
            function finish(error, validations) {
                //is not well formatted job
                //back-off
                if (error) {
                    done(error);
                }
                //otherwise create a job
                else {
                    //extend default job options with
                    //custom job definition
                    var jobDefaults = {
                        priority: 'normal',
                        attempts: 3,
                        backoff: {
                            delay: 60 * 1000,
                            type: 'fixed'
                        },
                        data: {
                            schedule: 'NOW'
                        }
                    };
                    jobDefinition = _.merge(jobDefaults, jobDefinition);

                    //instantiate kue job
                    var job =
                        kue.createJob(jobDefinition.type, jobDefinition.data);

                    //apply all job attributes into kue job instance
                    _.keys(jobDefinition).forEach(function(attr) {
                        var fn = job[attr];
                        if (_.isFunction(fn)) {
                            fn.call(job, jobDefinition[attr]);
                        }
                    });

                    //we are done
                    done(null, job, validations);
                }
            });
};

/**
 * kue job schema
 * {
 *       id: Number,
 *       type: String,
 *       data: Object,
 *       result: String,
 *       priority: Number,
 *       progress: Number,
 *       state: String,
 *       error: String|Object,
 *       created_at: Date,
 *       promote_at: Date,
 *       updated_at: Date,
 *       failed_at: Date,
 *       duration: Number,
 *       delay: Number|Date,
 *       attempts: {
 *           made: Number,
 *           remaining: Number,
 *           max: Number
 *       }
 *   };
 */

/**
 * kue job events
 * - `enqueue` the job is now queued
 *- `promotion` the job is promoted from delayed state to queued
 *- `progress` the job's progress ranging from 0-100
 *- 'failed attempt' the job has failed, but has remaining attempts yet
 *- `failed` the job has failed and has no remaining attempts
 *- `complete` the job has completed
 */

/**
 * @description export kue scheduler
 * @type {Function}
 */
module.exports = KueScheduler;