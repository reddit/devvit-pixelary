// Handler exports
export { handleWords } from './words';
export { handleAdd } from './add';
export { handleRemove } from './remove';
export { handleStats } from './stats';
export { handleScore } from './score';
export { handleShow } from './show';
export { handleHelp } from './help';

// Champion comment utilities
export {
  setWordChampion,
  getWordChampion,
  removeWordChampion,
  getAllChampionWords,
  isWordChampion,
} from '../dictionary';

// Dictionary utilities
export { isWordBanned } from '../dictionary';
