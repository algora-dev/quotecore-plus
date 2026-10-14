require('../../tools/billing-p2/ts-runtime.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const {voiceActualMicroUsd,voiceCostRatesFromEnv}=require('../../app/lib/billing/custom/usage/voice-cost.ts');

const rates={inputMicroUsdPerMillionTokens:1_250_000,outputMicroUsdPerMillionTokens:5_000_000};
test('voice cost uses provider token usage and rounds micro-USD upward',()=>{
 assert.equal(voiceActualMicroUsd({type:'tokens',input_tokens:1000,output_tokens:100},rates),1750);
 assert.equal(voiceActualMicroUsd({type:'tokens',input_tokens:1,output_tokens:0},rates),2);
});
test('voice cost refuses unknown or malformed usage',()=>{
 assert.equal(voiceActualMicroUsd({type:'duration',seconds:10},rates),null);
 assert.equal(voiceActualMicroUsd({type:'tokens',input_tokens:-1,output_tokens:0},rates),null);
 assert.equal(voiceActualMicroUsd(null,rates),null);
});
test('voice cost env requires both reviewed integer rates',()=>{
 assert.deepEqual(voiceCostRatesFromEnv({CUSTOM_VOICE_INPUT_MICROUSD_PER_MILLION_TOKENS:'1250000',CUSTOM_VOICE_OUTPUT_MICROUSD_PER_MILLION_TOKENS:'5000000'}),rates);
 assert.equal(voiceCostRatesFromEnv({CUSTOM_VOICE_INPUT_MICROUSD_PER_MILLION_TOKENS:'1250000'}),null);
});
