from __future__ import print_function
import json
import boto3
import os

stackoutputs = None
stackname = os.getenv('CFSTACK')

def handler(event, context):

    jsondump = json.dumps(event)
    print(jsondump)

    try:
        #Because "sub documents", like a sofa document that is connected to a room document, does not have a next, the in built query lambda attempts to figure out a parent document and will give the necessary information to perform room iteration
        previousToJson = event["req"]["session"]["qnabotcontext"]["previous"]
        navigationToJson = event["req"]["session"]["qnabotcontext"]["navigation"]
        qid = previousToJson["qid"]
        nextDoc = navigationToJson["next"]
    except KeyError as k:
        # hit this case if user calls next on a client with no other answered phrases
        event["res"]["session"]["qnabotcontext"]["previous"]={}
        event["res"]["session"]["qnabotcontext"]["navigation"]={}
        return event
    
    #for now we only go to the first document in list of next documents, change later when we add functionality for branching and converging paths
    if isinstance(nextDoc,list):
        response = qidLambda(event, nextDoc[0])
    else:
        response = qidLambda(event, nextDoc)
    #uncomment below if you want to see the response 
    #print(json.dumps(response))

    # Do not call lambdafunction from the next item if the link points to ourselves
    function_name=response.get('l', '')
    if function_name != '' and function_name != 'QNA:ExamplePYTHONLambdaNext' and os.environ.get('AWS_LAMBDA_FUNCTION_NAME') not in function_name:
        # This update will pull in standard qid content into the eventual result passed back up the stack
        event = updateResult(event,response)
        if "args" in response:
            event["res"]["result"]["args"] = response["args"]
        client = boto3.client('lambda')
        targetname = response.get('l', '')
        if targetname.startswith('arn') != True:
            targetname = mapToArn(targetname, stackname)
        lhresp = client.invoke(
            FunctionName = targetname,
            Payload = json.dumps(event),
            InvocationType = "RequestResponse"
        )
        # Because the payload is of a streamable type object, we must explicitly read it and load JSON
        event = updateLambdaHook(event,json.loads(lhresp['Payload'].read()),response)
    elif 'a' in response:
        event = updateResult(event, response)
        # No lambda hook to call so just merge in content from the target question(event,response)
        # modify the event to make the previous question the redirected question that was just asked instead of "Next Question"
    else:
        #if the response has no answer we must have hit the end of the guided navigation for this segment
        #if unable to find anything, set the previous attribute back to the document qid that was previously returned,since we don't want this document to be in history
        event["res"]["session"]["qnabotcontext"]["previous"]={"qid":qid,"q":previousToJson["q"]}
        event["res"]["session"]["qnabotcontext"]["navigation"]={"next":navigationToJson["next"],"previous":navigationToJson["previous"],"hasParent":navigationToJson["hasParent"]} 
    print(json.dumps(event))
    return event


#Invoke the prepackaged function that Queries ElasticSearch using a document qid
def qidLambda(event,nextQid):
    client = boto3.client('lambda')
    #Invoke the prepackaged function that Queries ElasticSearch using a document qid
    resp = client.invoke(
        FunctionName = event["req"]["_info"]["es"]["service"]["qid"],
        Payload = json.dumps({'qid':nextQid}),
        InvocationType = "RequestResponse"
    )
    # Because the payload is of a streamable type object, we must explicitly read it and load JSON 
    tempResponse = resp['Payload'].read()
    print(tempResponse)
    response = json.loads(tempResponse)
    return response

#maps a shortname to the full name via CF Output stack value
def mapToArn(name,stack):
    res = name
    global stackoutputs
    if stackoutputs is None:
        cf = boto3.client('cloudformation')
        r = cf.describe_stacks(StackName=stack)
        stack, = r['Stacks']
        stackoutputs = stack['Outputs']
    for o in stackoutputs:
        if name == 'QNA:' + o['OutputKey']:
            res = o['OutputValue']
            break
    return res

#update the event with the information if there is a Lambda hook
def updateLambdaHook(event,hookEvent, response):
    previousToJson = event["req"]["session"]["qnabotcontext"]["previous"]
    navigationToJson = event["req"]["session"]["qnabotcontext"]["navigation"]
    #only append to navigation list if top level document or not returning the same document from before(if a document points to itself as the next document)
    tempList= navigationToJson["previous"]
    if not navigationToJson["hasParent"]:
        if(len(tempList) == 0):
            tempList.append(previousToJson["qid"])
        elif(tempList[-1] != previousToJson["qid"]):
            print(tempList[-1])
            print(previousToJson["qid"])
            tempList.append(previousToJson["qid"])
    if len(tempList) > 10:
        #setting limit to 10 elements in previous stack since ,since lex has a max header size and we want to save that for other functions, same max size is set in the query lambda
        tempList.pop(0)
    if "session" not in hookEvent["res"]:
        hookEvent["res"]["session"] = {}
    hookEvent["res"]["session"]["qnabotcontext"]["previous"] ={"qid":response["qid"],"q":event["req"]["question"]}
    hookEvent["res"]["session"]["qnabotcontext"]["navigation"]={"next":response.get("next",""),"previous":tempList,"hasParent":False}
    return hookEvent

#update the event with the information from the new Query
def updateResult(event, response):
    event["res"]["result"] = response
    event["res"]["type"] = "PlainText"
    event["res"]["message"] = response["a"]
    event["res"]["plainMessage"]=response["a"]
    event["res"]["session"]["appContext"]["altMessages"] = response.get("alt",{})

    if "outputDialogMode" not in event["req"] or event["req"]["outputDialogMode"]!="Text":
        if response.get("alt",False) and "ssml" in response["alt"] and len(response["alt"]["ssml"])>0:
            event["res"]["type"]="SSML"
            event["res"]["message"]=response["alt"]["ssml"].replace('\n',' ')
            
    if "r" in response:
        card = response["r"]
        if 'title' in card:
            #making sure that the title is not empty, as we don't want to be sending empty cards
            if card["title"]!="":
                event["res"]["card"]["send"] = True
                event["res"]["card"]["title"] = card["title"]
                try:
                    event["res"]["card"]["text"] = card["text"]
                except:
                    event["res"]["card"]["text"] = ""
                if 'subTitle' in card:
                    event["res"]["card"]["subTitle"] = card["subTitle"]
                if 'imageUrl' in card:
                    event["res"]["card"]["imageUrl"] = card["imageUrl"]
                if 'buttons' in card:
                    event["res"]["card"]["buttons"] = card["buttons"]
    if 't' in response:
        event["res"]["session"]["topic"] = response["t"]

    previousToJson = event["req"]["session"]["qnabotcontext"]["previous"]
    navigationToJson = event["req"]["session"]["qnabotcontext"]["navigation"]
    tempList= navigationToJson["previous"]
    #only append to navigation list if top level document or not returning the same document from before(if a document points to itself as the next document)
    if not navigationToJson["hasParent"]:
        if(len(tempList) == 0):
            tempList.append(previousToJson["qid"])
        elif(tempList[-1] != previousToJson["qid"]):
            print(tempList[-1])
            print(previousToJson["qid"])
            tempList.append(previousToJson["qid"])
    if len(tempList) > 10:
        #setting limit to 10 elements in previous stack since ,since lex has a max header size and we want to save that for other functions, same max size is set in the query lambda
        tempList.pop(0)
    event["res"]["session"]["qnabotcontext"]["previous"] ={"qid":response["qid"],"q":event["req"]["question"]}
    event["res"]["session"]["qnabotcontext"]["navigation"]={"next":response.get("next",""),"previous":tempList,"hasParent":False} 
    return event

