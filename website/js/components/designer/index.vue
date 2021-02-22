<template lang='pug'>
  v-card.root-card
    v-card-title.pa-0.cyan
      v-layout(row)
        v-tabs(
          v-model="active" 
          slide-color="accent"
          color="primary" 
          light
        )
          v-tab.title(ripple href="#questions" id="questions-tab") Questions
          v-tab.title(ripple href="#test" id="test-tab") Test
          v-tab.title(ripple href="#testAll" id="testAll-tab") Test All
        v-spacer
        v-menu(bottom left)
          v-btn.white--text(icon slot="activator" id="edit-sub-menu")
            v-icon more_vert
          v-list
            v-list-tile
              alexa
            v-list-tile
              build
            v-list-tile
              sync
            v-list-tile
              crawler
    span
      questions(@filter="get(pagination)" v-if="active==='questions'")
      test(v-if="active==='test'")
      testAll(v-if="active==='testAll'")
    v-data-table(
      v-if="active!=='testAll'"
      :headers="headers"
      :items="QAs"
      :search="search"
      :pagination.sync="pagination"
      :total-items="total"
      :loading="loading"
      :rows-per-page-items="perpage"
      :class="empty"
      v-model="selected"
      select-all
      item-key="qid"
    )
      template(slot='headers' slot-scope='props')
        tr
          th.shrink(v-if="active==='questions'" id="select-all")
            v-checkbox(
              :indeterminate="QAs.length===0" v-model='selectAll' 
              tabindex='-1'
              color="primary" @change="toggleSelectAll" 
            )
          th.shrink.title(v-if="active==='test'") score
          th.text-xs-left.title( v-for="header in props.headers" 
            :key='header.text'
            :class="['column', header.sortable ? 'sortable' : '', pagination.descending ? 'desc' : 'asc', header.value === pagination.sortBy ? 'active' : '']"
            @click="header.sortable ? changeSort(header.value) : null") 
              v-icon(v-if="tab==='questions' && header.sortable") arrow_upward
              span {{header.text}}
          th.d-flex.pa-0
            span(v-if="selectAll | selectedMultiple" id="delete-all")
              delete(:selectAll="selectAll" :selected="selected")
      template(slot='items' slot-scope='props')
        tr( 
          v-on:click="expand(props)"
          :id="'qa-'+props.item.qid"
        )
          td.shrink(v-on:click.stop="" v-if="active==='questions'")
            v-checkbox(@change="checkSelect"
              v-model="props.item.select" tabindex='-1' color="primary" 
              :id="'qa-'+props.item.qid+'-select'"
            )
          td.text-xs-left.shrink.primary--text.title(
            v-if="active==='test'"
          ) {{props.item._score || '-'}}
          td.text-xs-left.shrink.title 
            b(:id="props.item.qid") {{props.item.qid}}
          td.text-xs-left.title {{props.item.type || 'qna'}}
          td.text-xs-left.title {{props.item.q[0] || props.item.question}}
          td.d-flex.pa-0.pr-1
            edit(
              :data.sync="props.item" 
              v-on:filter="get(pagination)"
              @click.native.stop=""
              :id="'qa-'+props.item.qid+'-edit'"
            )
            delete( :data="props.item" 
              @click.native.stop=""
              :id="'qa-'+props.item.qid+'-delete'"
            )
      template(slot="expand" slot-scope='props')
        qa(:data="props.item")
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
  data:()=>{return {
    drawer:false,
    active:null,
    tab:"",
    search:'',
    selected:[],
    selectAll:false,
    perpage:[
      "5","10","15","50","100"
    ],
    pagination:{
      page:1,
      rowsPerPage:"100",
      sortBy:'qid'
    },
    headers:[{
      text:'Id',
      value:'qid',
      align:'left',
      sortable:true
    },
    {
      text:'Type',
      value:'type',
      align:'left'
    },
    {
      text:'First Question',
      value:'q[0] || a',
      align:'left'
    }]
  }},
  components:{
    qa:require('./qa.vue').default,
    questions:require('./menu-questions.vue').default,
    test:require('./menu-test.vue').default,
    testAll:require('./menu-testall.vue').default,
    delete:require('./delete.vue').default,
    edit:require('./edit.vue').default,
    build:require('./rebuild.vue').default,
    alexa:require('./alexa.vue').default,
    sync:require('./synckendra.vue').default,
    crawler:require('./crawler.vue').default

  },
  computed:{
    empty:function(){
      return {empty:!this.total}
    },
    loading:function(){
      return this.$store.state.api.loading 
    },
    QAs:function(){
      return this.$store.state.data.QAs
    },
    total:function(){
      return this.$store.state.page.total
    },
    selectedMultiple:function(){
      return this.QAs.map(x=>x.select).includes(true)
    }
  },
  created:async function(){
    await this.$store.dispatch('data/schema')
    await this.get(1)
  },
  watch:{
    tab:function(tab){
      if(tab==='test'){
        this.pagination.sortBy='score'
        this.pagination.descending=true
      }else{
        this.pagination.sortBy='qid'
        this.pagination.descending=false
        return this.get(this.pagination)
      }
    },
    "pagination.page":function(event){
      return this.get(this.pagination)      
    },
    "pagination.descending":function(event){
      return this.get(this.pagination)      
    },
    "pagination.rowsPerPage":function(event){
      return this.get(this.pagination)      
    },
    "pagination.sortBy":function(event){
      return this.get(this.pagination)  
		}
  },
  methods:{
    get:_.debounce(async function(event){
        if (this.active === 'questions') {
            this.selectAll = false
            await this.$store.dispatch('data/get', {
                page: event.page - 1,
                perpage: event.rowsPerPage,
                order: event.descending ? 'desc' : 'asc'
            })
        }
    },100,{trailing:true,leading:false}),
    changeSort:_.debounce(function(column) {
      if(this.tab==='questions'){
        if (this.pagination.sortBy === column) {
          this.pagination.descending = !this.pagination.descending
        } else {
          this.pagination.sortBy = column
          this.pagination.descending = false
        }
        this.get(this.pagination)
      }
    },500,{trailing:false,leading:true}),
    checkSelect:function(value){
      this.selectAll=this.selectAll && value
    },
    toggleSelectAll:function(value){
      this.$store.commit('data/selectAll',value)
      this.selectAll=value
    },
    expand:_.debounce(function(prop) {
      prop.expanded = !prop.expanded
    },100,{trailing:true,leading:false}),
    edit:console.log
  }
}
</script>
<style lang='scss'>
  .tabs__item {
    color:white !important; 
  }
  .empty .datatable__actions__pagination {
    display:none;
  }
</style>
<style lang='scss' scoped>
  
  .shrink {
    width:10%;
  }
  .root-card {
    margin:auto;
  }
  .icon {
    cursor:pointer;
  }
  .datatable thead th.title {
    .icon {
      font-size:inherit;
    }
  }
  .buttons {
    position:absolute;
    right:0;
  }
  tr {
    position:relative;
  }
</style>

