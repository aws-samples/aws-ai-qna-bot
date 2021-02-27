# Kendra Web Indexer Integration

Please read the [Kendra Integration](../../workshops/kendra/README.md) for instructions about configuring Kendra



QnABot can now index your website with Kendra and answer questions based on what it has found.

Go to the Settings option in the Tools menu


![](./settings.png)

1. Enable the indexer by setting _ENABLE_WEB_INDEXER_ to true
1. Tell QnABot which pages to index by specifying a comma separated list of addreses in _KENDRA_INDEXER_URLS_
1. The indexer can be configured to run on a schedule by setting the _KENDRA_INDEXER_SCHEDULER_
   It supports standard [CloudWatch Events rate syntax]()

After you save your settings, go back to the Tools Menu and then choose **Kendra Web Page Indexing**

![](./tools.png)

![](./NoIndexDialog.png)

If your seettings are correct, the first time you choose the option, you should see the following dialog.

Just press **Start Indexing** to index your web pages to Kendra.  

The Content Designer will show you a history of your indexing.

![](./IndexDialog.png)



