<template lang='pug'>
  v-app
    v-navigation-drawer(temporary v-model="drawer" app)
      v-toolbar(flat)
        v-list
          v-list-tile
            v-list-tile-title.title Tools
      v-divider
      v-list(dense three-line subheader)
        v-list-tile(v-for="(page,key) in pages" :key="key"
          @click="drawer=false" 
          :href="page.href"
          :id="'page-link-'+page.id"
          :target="page.target || '_self'") 
          v-list-tile-avatar
            v-icon(color="primary") {{page.icon}}
          v-list-tile-content
            v-list-tile-title {{page.title}}
            v-list-tile-sub-title {{page.subTitle}}
        v-list-group( prepend-icon="info" value="true" color="primary")
          v-list-tile(slot="activator") 
            v-list-tile-title QnABot Help
          v-list-tile
            v-list-tile-content 
              v-list-tile-title Version: {{Version}}
              v-list-tile-title BuildDate: {{BuildDate}}
          v-list-tile
            v-list-tile-content
              v-list-tile-title 
                a(href="https://amazon.com/qnabot" target="_blank") General Instructions / QnABot Blog Post
              v-list-tile-title
                a(href="https://aws.amazon.com/blogs/machine-learning/creating-virtual-guided-navigation-using-a-question-and-answer-bot-with-amazon-lex-and-amazon-alexa/" target="_blank") Guided Navigation using QnABot
              v-list-tile-title
                a(href="https://aws.amazon.com/blogs/machine-learning/create-a-questionnaire-bot-with-amazon-lex-and-amazon-alexa/" target="_blank") Create a questionnaire using QnABot
    v-toolbar(app fixed)
      v-toolbar-side-icon.primary--text(
        id="nav-open"
        @click.stop="drawer = !drawer"
      )
      v-toolbar-title 
        v-breadcrumbs
          v-breadcrumbs-item(href='#/edit') {{$store.state.info.StackName}}:{{$store.state.user.name}}
          v-breadcrumbs-item {{page}}
      v-spacer
      v-toolbar-items
        v-btn.primary--text(flat
          id="logout-button"
          @click="logout"
          v-if="login") LogOut
    v-container(fluid id="workspace")
      v-layout(column)
        v-flex
          router-view
    v-footer
</template>

<script>
/*
Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License"). You may not use this file
except in compliance with the License. A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed on an "AS IS"
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the
License for the specific language governing permissions and limitations under the License.
*/

var Vuex=require('vuex')
var Promise=require('bluebird')
var _=require('lodash')
module.exports={
  data:()=>{
    return {
    drawer:false
  }},
  components:{},
  computed:{
    page:function(){
      return _.get(this,'$store.state.route.name','')
    },
    error:function(){
      return this.$store.state.error
    },
    username:function(){
      return this.$store.state.user.name
    },
    Version:function(){
      return _.get(this,"$store.state.info.Version")
    },
    BuildDate:function(){
      return _.get(this,"$store.state.info.BuildDate")
    },
    login:function(){
      return _.get(this,"$store.state.info._links.DesignerLogin.href")
    },
    client:function(){
      return _.get(this,"$store.state.info._links.ClientLogin.href")
    },
    pages:function(){
      return [{
        title:"Edit",
        id:"edit",
        subTitle:"Edit questions and simulate responses",
        icon:"mode_edit",
        href:"#/edit"
      },{
        title:"Settings",
        id:"settings",
        subTitle:"View and Modify QnABot configuration settings",
        icon:"settings",
        href:"#/settings"
      },{
        title:"Import",
        id:"import",
        subTitle:"Import new questions",
        icon:"cloud_upload",
        href:"#/import"
      },
      {
        title:"Import Custom Translation",
        id:"customTranslate",
        subTitle:"Import custom translation terminology",
        icon:"transform",
        href:"#/customTranslate"
      },
      {
        title:"Export",
        id:"export",
        subTitle:"Download backups of your QnAs",
        icon:"file_download",
        href:"#/export"
      },{
        title:"Alexa",
        id:"alexa",
        subTitle:"Instructions for setting up an Alexa Skill",
        icon:"info",
        href:"#/alexa"
      },
      {
        title:"Connect",
        id:"connect",
        subTitle:"Instructions for integrating with Connect",
        icon:"info",
        href:"#/connect"
      },
      {
        title:"Lambda Hooks",
        id:"hooks",
        subTitle:"Instructions for customizing QnABot behavior using AWS Lambda",
        icon:"settings_input_component",
        href:"#/hooks"
      },{
        title:"QnABot Client",
        id:"client",
        subTitle:"Use QnABot to interact with your bot in the browser",
        icon:"forum",
        target:'_blank',
        href:_.get(this,"$store.state.info._links.ClientLogin.href")
      },{
        title:"Kibana Dashboard",
        id:"kibana",
        subTitle:"Analyze ChatBot usage",
        icon:"show_chart",
        target:'_blank',
        href:_.get(this,"$store.state.info._links.Kibana.href")+"#/dashboards?_g=()"
      }]
    }
  },
  created:function(){},
  methods:{
    logout:function(){
      this.$store.dispatch('user/logout')
      window.location=this.login
    }
  },
  onIdle:function(){
    window.alert("Sorry, you are being logged out for being idle. Please log back in")
    this.logout()
  }
}
</script>

<style lang='scss' scoped>
  #workspace {
    margin-top:60px;
  }
</style>

