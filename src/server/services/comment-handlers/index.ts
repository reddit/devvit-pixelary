// Handler exports
export { handleWords } from './words';
export { handleAdd } from './add';
export { handleRemove } from './remove';
export { handleWord } from './word';
export { handleScore } from './score';
export { handleShow } from './show';
export { handleHelp } from './help';

// Champion comment utilities
export {
  setChampionComment,
  getChampionComment,
  removeChampionComment,
  getAllChampionWords,
  findChampionCommentByCommentId,
} from '../dictionary';

// Dictionary utilities
export { isWordBanned } from '../dictionary';
