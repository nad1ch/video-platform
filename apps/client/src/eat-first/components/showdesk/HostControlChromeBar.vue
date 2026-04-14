<script setup>
import { computed } from 'vue'
import { hostControlChromeStore as store } from '../../composables/hostControlChrome.js'
import HostChromeControlsColumn from '../../ui/organisms/hostChrome/HostChromeControlsColumn.vue'
import HostChromeVoteColumn from '../../ui/organisms/hostChrome/HostChromeVoteColumn.vue'
import HostChromeTimerColumn from '../../ui/organisms/hostChrome/HostChromeTimerColumn.vue'

const votingActive = computed(() => Boolean(store.gameRoom?.voting?.active))
</script>

<template>
  <div class="hcc" :class="{ 'hcc--vote-on': votingActive }">
    <div class="hcc-split">
      <HostChromeControlsColumn />
      <HostChromeVoteColumn />
      <HostChromeTimerColumn />
    </div>
  </div>
</template>

<style src="../../styles/host-chrome.css"></style>
