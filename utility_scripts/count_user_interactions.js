#! /usr/bin/env node

(async () => {
process.env.AWS_SDK_LOAD_CONFIG = true;
var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();
args = process.argv.slice(2);

if(args.length != 1)
{
    console.log("Must specify DynamoDB tablename");
    throw "Must specify DynamoDB tablename"
}

const getAllData = async (params) => {
    const _getAllData = async (params, startKey) => {
      if (startKey) {
        params.ExclusiveStartKey = startKey
      }
      return dynamodb.scan(params).promise()
    }
    let lastEvaluatedKey = null
    let rows = [];
    let count = 0;
    do {
      const result = await _getAllData(params, lastEvaluatedKey)
      count += result.Count;
      rows = rows.concat(result.Items)
      lastEvaluatedKey = result.LastEvaluatedKey
    } while (lastEvaluatedKey)
    return {Rows: rows, Count: count};
  }


var params = {

    ExpressionAttributeValues: {
     ":count": {
       N: "1"
      },
      ":seconds":{
          N: `${60*60*24*30}`
      }
    }, 
    FilterExpression: `InteractionCount > :count AND TimeSinceLastInteraction < :seconds`, 
    TableName: args[0],
    Select: "COUNT"


   };
   var alldata = await getAllData(params);

   console.log(`Users with more than one interaction ${alldata.Count}`)

 






})();