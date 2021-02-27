## Using Custom Terminologies with Amazon Translate

QnABot now supports Amazon Translate's [custom terminology](https://docs.aws.amazon.com/translate/latest/dg/how-custom-terminology.html) feature.

Using custom terminology with your translation requests enables you to make sure that your brand names, character names, model names, and other unique content is translated exactly the way you need it, regardless of its context and the Amazon Translate algorithm’s decision.


First created a [comma separated file to import.](https://docs.aws.amazon.com/translate/latest/dg/creating-custom-terminology.html)

en | fr | de | es | 
---|-----|---|----
 custom terminology| custom terminology| custom terminology| custom terminology|

Then go to the Tools menu and choose **Import Custom Terminology**

![](./tools.png)

You will then see the following dialog

![](./terminology1.png)

Enter a description and click on **Choose File**


![](./uploadterminology.png)

Once the file is sucessfully uploaded, you should see the following

![](./terminology_uploaded.png)

Now let's see what it does...

Let's go back to the Content Designer and enter a question.


![](./translate_question.png)

And let's ask the question in Spanish

![](./custom_terminology_disabled.png)

We consider "custom terminology" to be a branded feature that shouldn't be translated.  We have already uploaded a custom terminology file.  But, we still need to enable custom terminology support.

Go to settinga in the **Tools** menu and enable custom terminology sources

![](./settings.png)

And now let's ask the question again, and see that our file worked...

![](./custom_terminology_enabled.png)

