import before from './discovery-reviewed.mjs';
import input from '../../data-candidates/discovery-20261015.json' with {type:'json'};
import weekly from '../../data-candidates/weekly-strategy-20261015.json' with {type:'json'};
import revisedWeekly from '../../data-candidates/weekly-strategy-20261015-revised.json' with {type:'json'};
import {mergeDiscoveryBatch} from '../../scripts/discovery-update.mjs';
import {mergeWeeklyReview} from '../../scripts/weekly-update.mjs';

export default mergeWeeklyReview(mergeWeeklyReview(mergeDiscoveryBatch(before,input),weekly),revisedWeekly);
