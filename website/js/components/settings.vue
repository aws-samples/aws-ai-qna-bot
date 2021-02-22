<template lang='pug'>
  v-container(grid-list-md)
    v-alert(v-model="successAlert" outline type="info" dismissible) Successfully saved settings!
    v-layout(column )
      v-flex
        v-card
          v-card-title 
            h3 Settings
          v-card-text
            v-list(three-line)
                v-list-tile(v-for="(parameter,index) in mergedSettings")
                    v-list-tile-content
                        v-text-field(:label="index"  v-model="settingsHolder[index]")
            v-btn(@click="SaveSettings") Save
            //- v-btn Add New parameter
            v-btn(@click="resetToDefaults") Reset to defaults
    
    v-btn(bottom fab fixed right @click="showAddModal = true")
        v-icon(color ="primary") add
    v-dialog(v-model ="showAddModal")
        v-card
            v-card-title New Setting
            v-card-text
                v-text-field(label="Name" v-model="newKey")
                v-text-field(label="Value" v-model="newValue")
            v-card-actions
                v-spacer
                v-btn(@click="addSetting") Add
                v-btn(@click="closeModal") Cancel
            
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
var Vuex = require('vuex')
var Promise = require('bluebird')
var _ = require('lodash')

module.exports = {
    data: function () {
        var self = this
        return {
            showAddModal: false,
            mergedSettings: {},
            defaultSettings: {},
            customSettings: {},
            settingsHolder: {},
            successAlert: false,
            newKey: "",
            newValue: ""
        }
    },
    components: {},
    computed: {},
    created: async function () {
        const settings = await this.$store.dispatch('api/listSettings');
        this.defaultSettings = _.clone(settings[0]);
        this.customSettings = _.clone(settings[1]);
        this.mergedSettings = _.clone(settings[2]);
        this.settingsHolder = _.clone(settings[2]);
    },
    methods: {
        SaveSettings: async function () {
            // update current customSettings with new values from settingsHolder
            for (let key in this.customSettings) {
                this.customSettings[key] = this.settingsHolder[key];
            }

            // place in customSettings any differences from defaultSettings
            for (let key in this.settingsHolder) {
                if (this.settingsHolder[key] !== this.defaultSettings[key]) {
                    this.customSettings[key] = this.settingsHolder[key];
                }
            }

            // remove any custom settings that are identical to default settings
            for (let key in this.customSettings) {
                if (this.customSettings[key] === this.defaultSettings[key]) {
                    delete this.customSettings[key];
                }
            }

            // clone object to send on api request - no chance of inflight updates from the ui
            const cloned_custom = _.clone(this.customSettings);
            let response = await this.$store.dispatch('api/updateSettings', cloned_custom);
            if (response) {
                this.successAlert = true;
                window.scrollTo(0, 0);
            }
        },
        resetToDefaults: async function () {
            let customOverride = {};
            let response = await this.$store.dispatch('api/updateSettings', customOverride);
            if (response) {
                this.customSettings = {};
                this.settingsHolder = _.clone(this.defaultSettings);
                this.successAlert = true;
                window.scrollTo(0, 0);
            }

        },
        showModal: async function() {
            this.showAddModal = true;
        },
        closeModal: async function() {
            this.showAddModal = false;
        },
        addSetting: async function() {
            if (this.newKey.length >= 1) {
                console.log('hi tom');
                this.mergedSettings[this.newKey] = this.newValue;
                this.customSettings[this.newKey] = this.newValue;
                this.settingsHolder[this.newKey] = this.newValue;
            }
            console.log(this.mergedSettings);

            this.showAddModal = false;
            this.newValue = "";
            this.newKey = "";
        }
    }
}
</script>