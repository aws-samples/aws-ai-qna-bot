/*
Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License"). You may not use this file
except in compliance with the License. A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed on an "AS IS"
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the
License for the specific language governing permissions and limitations under the License.
*/
var query=require('query-string').stringify
var _=require('lodash')
var Promise=require('bluebird')
var axios=require('axios')
var Url=require('url')
var sign=require('aws4').sign
var path=require('path')
var Mutex=require('async-mutex').Mutex
var aws=require('aws-sdk')
const mutex = new Mutex();

var reason=function(r){
    return (err)=>{ 
        console.log(err)
        Promise.reject(r)
    }
}
var aws=require('aws-sdk')
var failed=false
module.exports={

    startKendraIndexing(context,opts){
        return context.dispatch('_request',{
            url:context.rootState.info._links.crawler.href+`/start?message=start&topic=${context.rootState.info.KendraCrawlerSnsTopic}`,
            method:'post'
        })
    },
    getKendraIndexingStatus(context,opts){
        return context.dispatch('_request',{
            url:context.rootState.info._links.crawler.href+`/status`,
            method:'post'
        })
    },
}






