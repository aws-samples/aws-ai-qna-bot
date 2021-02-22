var stack=require('../util').stacktest
var Promise=require('bluebird')
var config=require('../../config')
var outputs=require('../../bin/exports')

module.exports=Promise.join(
    Promise.resolve(require('../master')),
    outputs('dev/bootstrap')
).spread(function(base,output){
    base.Parameters.BootstrapBucket.Default=output.Bucket
    base.Parameters.BootstrapPrefix.Default=output.Prefix
    base.Parameters.Email.Default=config.devEmail
    base.Parameters.Encryption.Default = config.devEncryption ? config.devEncryption : base.Parameters.Encryption.Default
    base.Parameters.PublicOrPrivate.Default = config.devPublicOrPrivate ? config.devPublicOrPrivate : base.Parameters.PublicOrPrivate.Default
    base.Parameters.ElasticSearchNodeCount.Default = config.devElasticSearchNodeCount ? config.devElasticSearchNodeCount : base.Parameters.ElasticSearchNodeCount.Default
    return base
})


