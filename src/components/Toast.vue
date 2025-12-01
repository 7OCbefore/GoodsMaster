<script setup>
defineProps(['show', 'msg', 'type']);
</script>

<template>
  <transition name="fade">
    <div v-if="show" class="fixed top-20 left-1/2 transform -translate-x-1/2 z-[999] pointer-events-none w-full px-6 flex justify-center">
      <div class="bg-primary/95 backdrop-blur text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 min-w-[140px] border border-white/10">
        <i v-if="type === 'success'" class="ph-fill ph-check-circle text-green-400 text-xl"></i>
        <i v-if="type === 'error'" class="ph-fill ph-x-circle text-red-400 text-xl"></i>
        <i v-if="type === 'warning'" class="ph-fill ph-warning-circle text-accent text-xl"></i>
        <span class="text-[14px] font-medium leading-tight text-center tracking-wide">{{ msg }}</span>
      </div>
    </div>
  </transition>
</template>