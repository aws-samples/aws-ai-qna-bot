module.exports={
    "ExportStack":{
        "Type" : "AWS::CloudFormation::Stack",
        "Properties" : {
            "TemplateURL" :{"Fn::Sub":"http://${BootstrapBucket}.s3.${AWS::Region}.amazonaws.com/${BootstrapPrefix}/templates/export.json"},
            "Parameters" :{
                "CFNLambda":{"Fn::GetAtt":["CFNLambda","Arn"]},
                "CFNInvokePolicy":{"Ref":"CFNInvokePolicy"},
                "BootstrapBucket":{"Ref":"BootstrapBucket"},
                "BootstrapPrefix":{"Ref":"BootstrapPrefix"},
                "VarIndex": {"Fn::GetAtt": ["Var", "QnaIndex"]},
                "EsEndpoint": {"Fn::GetAtt": ["ESVar", "ESAddress"]},
                "EsProxyLambda": {"Fn::GetAtt":["ESProxyLambda","Arn"]},
                "ExportBucket": {"Ref":"ExportBucket"},
                "VPCSubnetIdList" : { "Fn::Join" : [ ",", {"Ref":"VPCSubnetIdList"} ] },
                "VPCSecurityGroupIdList": { "Fn::Join" : [ ",", {"Ref":"VPCSecurityGroupIdList"} ] },
                "XraySetting":{"Ref": "XraySetting"},
                "FallbackIntent": {"Ref":"IntentFallback"},
                "Intent":{"Ref":"Intent"},
                "BotName":{"Ref":"LexBot"},
                "Api":{"Ref":"API"},
                "ApiRootResourceId":{"Fn::GetAtt":["API","RootResourceId"]},
                "Encryption":{"Ref":"Encryption"},
                "Stage":{"Ref":"Stage"},
                "ApiDeploymentId":{"Ref":"Deployment"},
                "KendraCrawlerSnsTopic":{"Ref":"KendraCrawlerSnsTopic"},
                "DefaultQnABotSettings":{"Ref":"DefaultQnABotSettings"},
                "CustomQnABotSettings":{"Ref":"CustomQnABotSettings"},
            }
        }
    }
}