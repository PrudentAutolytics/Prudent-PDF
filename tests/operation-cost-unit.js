'use strict';
const assert=require('assert');
const {calculateOperationCost,MODEL_VERSION}=require('../api/operation-cost');
const split=calculateOperationCost('PDF_SPLIT',20,5,1);
const merge=calculateOperationCost('PDF_MERGE',20,5,5);
const video=calculateOperationCost('VIDEO_FACE_REDACTION',0,250,1);
assert.strictEqual(MODEL_VERSION,'2026.07-op-v1');
for(const value of [split,merge,video]){
 assert(value.platformCost>0,'platform cost must be positive');
 assert(value.productPrice>=value.platformCost,'product estimate must not be below platform cost');
 assert(value.breakdown.paFlow>0,'Power Automate metering cost must be represented');
}
assert(merge.platformCost>split.platformCost,'multi-source merge should cost more than single-source split at same page and size input');
assert(video.platformCost>split.platformCost,'video face redaction should carry a higher workload factor');
console.log('Operation cost model unit tests passed.');
