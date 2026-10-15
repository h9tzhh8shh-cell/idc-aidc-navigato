import baseline from './v1-baseline-catalog.json' with {type:'json'};
import initial from '../../data-candidates/discovery-v1-20261014.json' with {type:'json'};
import revision from '../../data-candidates/discovery-r2-20261014.json' with {type:'json'};
import weekly from '../../data-candidates/weekly-strategy-20261014.json' with {type:'json'};
import {mergeDiscoveryBatch} from '../../scripts/discovery-update.mjs';
import {mergeWeeklyReview} from '../../scripts/weekly-update.mjs';

// These tests describe the reviewed October 14 snapshots, independent of later imports.
export default mergeWeeklyReview(mergeDiscoveryBatch(mergeDiscoveryBatch(baseline,initial),revision),weekly);
