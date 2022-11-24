/* eslint prefer-template: 0 */
import React, {
  forwardRef,
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
} from 'react';

/**
 * Check if the provided file type should be accepted by the input with accept attribute.
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Input#attr-accept
 *
 * Inspired by https://github.com/enyo/dropzone
 *
 * @param file {File} https://developer.mozilla.org/en-US/docs/Web/API/File
 * @param acceptedFiles {string}
 * @returns {boolean}
 */

function accepts(
  file: { name?: string; type?: string },
  acceptedFiles: string | string[],
): boolean {
  if (file && acceptedFiles) {
    const acceptedFilesArray = Array.isArray(acceptedFiles)
      ? acceptedFiles
      : acceptedFiles.split(',');
    const fileName = file.name || '';
    const mimeType = (file.type || '').toLowerCase();
    const baseMimeType = mimeType.replace(/\/.*$/, '');

    return acceptedFilesArray.some((type) => {
      const validType = type.trim().toLowerCase();
      if (validType.charAt(0) === '.') {
        return fileName.toLowerCase().endsWith(validType);
      } else if (validType.endsWith('/*')) {
        // This is something like a image/* mime type
        return baseMimeType === validType.replace(/\/.*$/, '');
      }
      return mimeType === validType;
    });
  }
  return true;
}

export const COMMON_MIME_TYPES = new Map([
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
  ['aac', 'audio/aac'],
  ['abw', 'application/x-abiword'],
  ['arc', 'application/x-freearc'],
  ['avif', 'image/avif'],
  ['avi', 'video/x-msvideo'],
  ['azw', 'application/vnd.amazon.ebook'],
  ['bin', 'application/octet-stream'],
  ['bmp', 'image/bmp'],
  ['bz', 'application/x-bzip'],
  ['bz2', 'application/x-bzip2'],
  ['cda', 'application/x-cdf'],
  ['csh', 'application/x-csh'],
  ['css', 'text/css'],
  ['csv', 'text/csv'],
  ['doc', 'application/msword'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['eot', 'application/vnd.ms-fontobject'],
  ['epub', 'application/epub+zip'],
  ['gz', 'application/gzip'],
  ['gif', 'image/gif'],
  ['heic', 'image/heic'],
  ['heif', 'image/heif'],
  ['htm', 'text/html'],
  ['html', 'text/html'],
  ['ico', 'image/vnd.microsoft.icon'],
  ['ics', 'text/calendar'],
  ['jar', 'application/java-archive'],
  ['jpeg', 'image/jpeg'],
  ['jpg', 'image/jpeg'],
  ['js', 'text/javascript'],
  ['json', 'application/json'],
  ['jsonld', 'application/ld+json'],
  ['mid', 'audio/midi'],
  ['midi', 'audio/midi'],
  ['mjs', 'text/javascript'],
  ['mp3', 'audio/mpeg'],
  ['mp4', 'video/mp4'],
  ['mpeg', 'video/mpeg'],
  ['mpkg', 'application/vnd.apple.installer+xml'],
  ['odp', 'application/vnd.oasis.opendocument.presentation'],
  ['ods', 'application/vnd.oasis.opendocument.spreadsheet'],
  ['odt', 'application/vnd.oasis.opendocument.text'],
  ['oga', 'audio/ogg'],
  ['ogv', 'video/ogg'],
  ['ogx', 'application/ogg'],
  ['opus', 'audio/opus'],
  ['otf', 'font/otf'],
  ['png', 'image/png'],
  ['pdf', 'application/pdf'],
  ['php', 'application/x-httpd-php'],
  ['ppt', 'application/vnd.ms-powerpoint'],
  ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['rar', 'application/vnd.rar'],
  ['rtf', 'application/rtf'],
  ['sh', 'application/x-sh'],
  ['svg', 'image/svg+xml'],
  ['swf', 'application/x-shockwave-flash'],
  ['tar', 'application/x-tar'],
  ['tif', 'image/tiff'],
  ['tiff', 'image/tiff'],
  ['ts', 'video/mp2t'],
  ['ttf', 'font/ttf'],
  ['txt', 'text/plain'],
  ['vsd', 'application/vnd.visio'],
  ['wav', 'audio/wav'],
  ['weba', 'audio/webm'],
  ['webm', 'video/webm'],
  ['webp', 'image/webp'],
  ['woff', 'font/woff'],
  ['woff2', 'font/woff2'],
  ['xhtml', 'application/xhtml+xml'],
  ['xls', 'application/vnd.ms-excel'],
  ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['xml', 'application/xml'],
  ['xul', 'application/vnd.mozilla.xul+xml'],
  ['zip', 'application/zip'],
  ['7z', 'application/x-7z-compressed'],

  // Others
  ['mkv', 'video/x-matroska'],
  ['mov', 'video/quicktime'],
  ['msg', 'application/vnd.ms-outlook'],
]);

export function toFileWithPath(file: FileWithPath, path?: string): FileWithPath {
  const f = withMimeType(file);
  if (typeof f.path !== 'string') {
    // on electron, path is already set to the absolute path
    const { webkitRelativePath } = file;
    Object.defineProperty(f, 'path', {
      value:
        typeof path === 'string'
          ? path
          : // If <input webkitdirectory> is set,
          // the File will have a {webkitRelativePath} property
          // https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory
          typeof webkitRelativePath === 'string' && webkitRelativePath.length > 0
          ? webkitRelativePath
          : file.name,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  }

  return f;
}

export interface FileWithPath extends File {
  readonly path?: string;
}

function withMimeType(file: FileWithPath) {
  const { name } = file;
  const hasExtension = name && name.lastIndexOf('.') !== -1;

  if (hasExtension && !file.type) {
    const ext = name.split('.').pop()!.toLowerCase();
    const type = COMMON_MIME_TYPES.get(ext);
    if (type) {
      Object.defineProperty(file, 'type', {
        value: type,
        writable: false,
        configurable: false,
        enumerable: true,
      });
    }
  }

  return file;
}

const FILES_TO_IGNORE = [
  // Thumbnail cache files for macOS and Windows
  '.DS_Store', // macOs
  'Thumbs.db', // Windows
];

/**
 * Convert a DragEvent's DataTrasfer object to a list of File objects
 * NOTE: If some of the items are folders,
 * everything will be flattened and placed in the same list but the paths will be kept as a {path} property.
 *
 * EXPERIMENTAL: A list of https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle objects can also be passed as an arg
 * and a list of File objects will be returned.
 *
 * @param evt
 */
export async function fromEvent(evt: Event | any): Promise<(FileWithPath | DataTransferItem)[]> {
  if (isObject<DragEvent>(evt) && isDataTransfer(evt.dataTransfer)) {
    return getDataTransferFiles(evt.dataTransfer, evt.type);
  } else if (isChangeEvt(evt)) {
    return getInputFiles(evt);
  } else if (
    Array.isArray(evt) &&
    evt.every((item) => 'getFile' in item && typeof item.getFile === 'function')
  ) {
    return getFsHandleFiles(evt);
  }
  return [];
}

function isDataTransfer(value: any): value is DataTransfer {
  return isObject(value);
}

function isChangeEvt(value: any): value is Event {
  return isObject<Event>(value) && isObject(value.target);
}

function isObject<T>(v: any): v is T {
  return typeof v === 'object' && v !== null;
}

function getInputFiles(evt: Event) {
  return fromList<FileWithPath>((evt.target as HTMLInputElement).files).map((file) =>
    toFileWithPath(file),
  );
}

// Ee expect each handle to be https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle
async function getFsHandleFiles(handles: any[]) {
  const files = await Promise.all(handles.map((h) => h.getFile()));
  return files.map((file) => toFileWithPath(file));
}

async function getDataTransferFiles(dt: DataTransfer, type: string) {
  // IE11 does not support dataTransfer.items
  // See https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/items#Browser_compatibility
  if (dt.items) {
    const items = fromList<DataTransferItem>(dt.items).filter((item) => item.kind === 'file');
    // According to https://html.spec.whatwg.org/multipage/dnd.html#dndevents,
    // only 'dragstart' and 'drop' has access to the data (source node)
    if (type !== 'drop') {
      return items;
    }
    const files = await Promise.all(items.map(toFilePromises));
    return noIgnoredFiles(flatten<FileWithPath>(files));
  }

  return noIgnoredFiles(fromList<FileWithPath>(dt.files).map((file) => toFileWithPath(file)));
}

function noIgnoredFiles(files: FileWithPath[]) {
  return files.filter((file) => FILES_TO_IGNORE.indexOf(file.name) === -1);
}

// IE11 does not support Array.from()
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from#Browser_compatibility
// https://developer.mozilla.org/en-US/docs/Web/API/FileList
// https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItemList
function fromList<T>(items: DataTransferItemList | FileList | null): T[] {
  if (items === null) {
    return [];
  }

  const files: any[] = [];

  // tslint:disable: prefer-for-of
  for (let i = 0; i < items.length; i++) {
    const file = items[i];
    files.push(file);
  }

  return files as any;
}

// https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem
function toFilePromises(item: DataTransferItem) {
  if (typeof item.webkitGetAsEntry !== 'function') {
    return fromDataTransferItem(item);
  }

  const entry = item.webkitGetAsEntry();

  // Safari supports dropping an image node from a different window and can be retrieved using
  // the DataTransferItem.getAsFile() API
  // NOTE: FileSystemEntry.file() throws if trying to get the file
  if (entry && entry.isDirectory) {
    return fromDirEntry(entry) as any;
  }

  return fromDataTransferItem(item);
}

function flatten<T>(items: any[]): T[] {
  return items.reduce(
    (acc, files) => [...acc, ...(Array.isArray(files) ? flatten(files) : [files])],
    [],
  );
}

function fromDataTransferItem(item: DataTransferItem) {
  const file = item.getAsFile();
  if (!file) {
    return Promise.reject(`${item} is not a File`);
  }
  const fwp = toFileWithPath(file);
  return Promise.resolve(fwp);
}

// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemEntry
async function fromEntry(entry: any) {
  return entry.isDirectory ? fromDirEntry(entry) : fromFileEntry(entry);
}

// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryEntry
function fromDirEntry(entry: any) {
  const reader = entry.createReader();

  return new Promise<FileArray[]>((resolve, reject) => {
    const entries: Promise<FileValue[]>[] = [];

    function readEntries() {
      // https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryEntry/createReader
      // https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryReader/readEntries
      reader.readEntries(
        async (batch: any[]) => {
          if (!batch.length) {
            // Done reading directory
            try {
              const files = await Promise.all(entries);
              resolve(files);
            } catch (err) {
              reject(err);
            }
          } else {
            const items = Promise.all(batch.map(fromEntry));
            entries.push(items);

            // Continue reading
            readEntries();
          }
        },
        (err: any) => {
          reject(err);
        },
      );
    }

    readEntries();
  });
}

// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileEntry
async function fromFileEntry(entry: any) {
  return new Promise<FileWithPath>((resolve, reject) => {
    entry.file(
      (file: FileWithPath) => {
        const fwp = toFileWithPath(file, entry.fullPath);
        resolve(fwp);
      },
      (err: any) => {
        reject(err);
      },
    );
  });
}

// Infinite type recursion
// https://github.com/Microsoft/TypeScript/issues/3496#issuecomment-128553540
interface FileArray extends Array<FileValue> {}
type FileValue = FileWithPath | FileArray[];

// Error codes
export const FILE_INVALID_TYPE = 'file-invalid-type';
export const FILE_TOO_LARGE = 'file-too-large';
export const FILE_TOO_SMALL = 'file-too-small';
export const TOO_MANY_FILES = 'too-many-files';

// File Errors
export const getInvalidTypeRejectionErr = (accept: any[]) => {
  accept = Array.isArray(accept) && accept.length === 1 ? accept[0] : accept;
  const messageSuffix = Array.isArray(accept) ? `one of ${accept.join(', ')}` : accept;
  return {
    code: FILE_INVALID_TYPE,
    message: `File type must be ${messageSuffix}`,
  };
};

export const getTooLargeRejectionErr = (maxSize: number) => {
  return {
    code: FILE_TOO_LARGE,
    message: `File is larger than ${maxSize} ${maxSize === 1 ? 'byte' : 'bytes'}`,
  };
};

export const getTooSmallRejectionErr = (minSize: number) => {
  return {
    code: FILE_TOO_SMALL,
    message: `File is smaller than ${minSize} ${minSize === 1 ? 'byte' : 'bytes'}`,
  };
};

export const TOO_MANY_FILES_REJECTION = {
  code: TOO_MANY_FILES,
  message: 'Too many files',
};

// Firefox versions prior to 53 return a bogus MIME type for every file drag, so dragovers with
// that MIME type will always be accepted
export function fileAccepted(file: any, accept: any) {
  const isAcceptable = file.type === 'application/x-moz-file' || accepts(file, accept);
  return [isAcceptable, isAcceptable ? null : getInvalidTypeRejectionErr(accept)];
}

export function fileMatchSize(file: any, minSize: any, maxSize: any) {
  if (isDefined(file.size)) {
    if (isDefined(minSize) && isDefined(maxSize)) {
      if (file.size > maxSize) return [false, getTooLargeRejectionErr(maxSize)];
      if (file.size < minSize) return [false, getTooSmallRejectionErr(minSize)];
    } else if (isDefined(minSize) && file.size < minSize)
      return [false, getTooSmallRejectionErr(minSize)];
    else if (isDefined(maxSize) && file.size > maxSize)
      return [false, getTooLargeRejectionErr(maxSize)];
  }
  return [true, null];
}

function isDefined(value: any) {
  return value !== undefined && value !== null;
}

/**
 *
 * @param {object} options
 * @param {File[]} options.files
 * @param {string|string[]} [options.accept]
 * @param {number} [options.minSize]
 * @param {number} [options.maxSize]
 * @param {boolean} [options.multiple]
 * @param {number} [options.maxFiles]
 * @param {(f: File) => FileError|FileError[]|null} [options.validator]
 * @returns
 */
export function allFilesAccepted({
  files,
  accept,
  minSize,
  maxSize,
  multiple,
  maxFiles,
  validator,
}: any) {
  if ((!multiple && files.length > 1) || (multiple && maxFiles >= 1 && files.length > maxFiles)) {
    return false;
  }

  return files.every((file: any) => {
    const [accepted] = fileAccepted(file, accept);
    const [sizeMatch] = fileMatchSize(file, minSize, maxSize);
    const customErrors = validator ? validator(file) : null;
    return accepted && sizeMatch && !customErrors;
  });
}

// React's synthetic events has event.isPropagationStopped,
// but to remain compatibility with other libs (Preact) fall back
// to check event.cancelBubble
export function isPropagationStopped(event: any) {
  if (typeof event.isPropagationStopped === 'function') {
    return event.isPropagationStopped();
  } else if (typeof event.cancelBubble !== 'undefined') {
    return event.cancelBubble;
  }
  return false;
}

export function isEvtWithFiles(event: any) {
  if (!event.dataTransfer) {
    return !!event.target && !!event.target.files;
  }
  // https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/types
  // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#file
  return Array.prototype.some.call(
    event.dataTransfer.types,
    (type) => type === 'Files' || type === 'application/x-moz-file',
  );
}

export function isKindFile(item: any) {
  return typeof item === 'object' && item !== null && item.kind === 'file';
}

// allow the entire document to be a drag target
export function onDocumentDragOver(event: any) {
  event.preventDefault();
}

function isIe(userAgent: any) {
  return userAgent.indexOf('MSIE') !== -1 || userAgent.indexOf('Trident/') !== -1;
}

function isEdge(userAgent: any) {
  return userAgent.indexOf('Edge/') !== -1;
}

export function isIeOrEdge(userAgent = window.navigator.userAgent) {
  return isIe(userAgent) || isEdge(userAgent);
}

/**
 * This is intended to be used to compose event handlers
 * They are executed in order until one of them calls `event.isPropagationStopped()`.
 * Note that the check is done on the first invoke too,
 * meaning that if propagation was stopped before invoking the fns,
 * no handlers will be executed.
 *
 * @param {Function} fns the event hanlder functions
 * @return {Function} the event handler to add to an element
 */
export function composeEventHandlers(...fns: any[]) {
  return (event: any, ...args: any) =>
    fns.some((fn) => {
      if (!isPropagationStopped(event) && fn) {
        fn(event, ...args);
      }
      return isPropagationStopped(event);
    });
}

/**
 * canUseFileSystemAccessAPI checks if the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
 * is supported by the browser.
 * @returns {boolean}
 */
export function canUseFileSystemAccessAPI() {
  return 'showOpenFilePicker' in window;
}

/**
 * Convert the `{accept}` dropzone prop to the
 * `{types}` option for https://developer.mozilla.org/en-US/docs/Web/API/window/showOpenFilePicker
 *
 * @param {AcceptProp} accept
 * @returns {{accept: string[]}[]}
 */
export function pickerOptionsFromAccept(accept: any) {
  if (isDefined(accept)) {
    const acceptForPicker = Object.entries(accept)
      .filter(([mimeType, ext]) => {
        let ok = true;

        if (!isMIMEType(mimeType)) {
          console.warn(
            `Skipped "${mimeType}" because it is not a valid MIME type. Check https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types for a list of valid MIME types.`,
          );
          ok = false;
        }

        if (!Array.isArray(ext) || !ext.every(isExt)) {
          console.warn(`Skipped "${mimeType}" because an invalid file extension was provided.`);
          ok = false;
        }

        return ok;
      })
      .reduce(
        (agg, [mimeType, ext]) => ({
          ...agg,
          [mimeType]: ext,
        }),
        {},
      );
    return [
      {
        // description is required due to https://crbug.com/1264708
        description: 'Files',
        accept: acceptForPicker,
      },
    ];
  }
  return accept;
}

/**
 * Convert the `{accept}` dropzone prop to an array of MIME types/extensions.
 * @param {AcceptProp} accept
 * @returns {string}
 */
export function acceptPropAsAcceptAttr(accept: Accept) {
  if (isDefined(accept)) {
    return (
      Object.entries(accept)
        .reduce((a, [mimeType, ext]) => [...a, mimeType, ...ext], [] as any[])
        // Silently discard invalid entries as pickerOptionsFromAccept warns about these
        .filter((v) => isMIMEType(v) || isExt(v))
        .join(',')
    );
  }

  return undefined;
}

/**
 * Check if v is an exception caused by aborting a request (e.g window.showOpenFilePicker()).
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/DOMException.
 * @param {any} v
 * @returns {boolean} True if v is an abort exception.
 */
export function isAbort(v: any) {
  return v instanceof DOMException && (v.name === 'AbortError' || v.code === v.ABORT_ERR);
}

/**
 * Check if v is a security error.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/DOMException.
 * @param {any} v
 * @returns {boolean} True if v is a security error.
 */
export function isSecurityError(v: any) {
  return v instanceof DOMException && (v.name === 'SecurityError' || v.code === v.SECURITY_ERR);
}

/**
 * Check if v is a MIME type string.
 *
 * See accepted format: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#unique_file_type_specifiers.
 *
 * @param {string} v
 */
export function isMIMEType(v: any) {
  return (
    v === 'audio/*' ||
    v === 'video/*' ||
    v === 'image/*' ||
    v === 'text/*' ||
    /\w+\/[-+.\w]+/g.test(v)
  );
}

/**
 * Check if v is a file extension.
 * @param {string} v
 */
export function isExt(v: any) {
  return /^.*\.[\w]+$/.test(v);
}

/**
 * @typedef {Object.<string, string[]>} AcceptProp
 */

/**
 * @typedef {object} FileError
 * @property {string} message
 * @property {ErrorCode|string} code
 */

/**
 * @typedef {"file-invalid-type"|"file-too-large"|"file-too-small"|"too-many-files"} ErrorCode
 */

export interface Accept {
  [key: string]: string[];
}

export interface DropzoneProps extends DropzoneOptions {
  children(state: DropzoneState): JSX.Element;
}

export const ErrorCode = {
  FileInvalidType: FILE_INVALID_TYPE,
  FileTooLarge: FILE_TOO_LARGE,
  FileTooSmall: FILE_TOO_SMALL,
  TooManyFiles: TOO_MANY_FILES,
};

export interface FileError {
  message: string;
  code: typeof ErrorCode | string;
}

export interface FileRejection {
  file: File;
  errors: FileError[];
}

export type DropzoneOptions = Pick<React.HTMLProps<HTMLElement>, PropTypes> & {
  accept?: Accept;
  minSize?: number;
  maxSize?: number;
  maxFiles?: number;
  preventDropOnDocument?: boolean;
  noClick?: boolean;
  noKeyboard?: boolean;
  noDrag?: boolean;
  noDragEventsBubbling?: boolean;
  disabled?: boolean;
  onDrop?: <T extends File>(
    acceptedFiles: T[],
    fileRejections: FileRejection[],
    event: DropEvent,
  ) => void;
  onDropAccepted?: <T extends File>(files: T[], event: DropEvent) => void;
  onDropRejected?: (fileRejections: FileRejection[], event: DropEvent) => void;
  getFilesFromEvent?: (event: DropEvent) => Promise<Array<File | DataTransferItem>>;
  onFileDialogCancel?: () => void;
  onFileDialogOpen?: () => void;
  onError?: (err: Error) => void;
  validator?: <T extends File>(file: T) => FileError | FileError[] | null;
  useFsAccessApi?: boolean;
  autoFocus?: boolean;
};

export type DropEvent =
  | React.DragEvent<HTMLElement>
  | React.ChangeEvent<HTMLInputElement>
  | DragEvent
  | Event;

export type DropzoneState = DropzoneRef & {
  isFocused: boolean;
  isDragActive: boolean;
  isDragAccept: boolean;
  isDragReject: boolean;
  isFileDialogActive: boolean;
  acceptedFiles: File[];
  fileRejections: FileRejection[];
  rootRef: React.RefObject<HTMLElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  getRootProps: <T extends DropzoneRootProps>(props?: T) => T;
  getInputProps: <T extends DropzoneInputProps>(props?: T) => T;
};

export interface DropzoneRef {
  open: () => void;
}

export interface DropzoneRootProps extends React.HTMLAttributes<HTMLElement> {
  refKey?: string;
  [key: string]: any;
}

export interface DropzoneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  refKey?: string;
}

type PropTypes = 'multiple' | 'onDragEnter' | 'onDragOver' | 'onDragLeave';

/**
 * Convenience wrapper component for the `useDropzone` hook
 *
 * ```jsx
 * <Dropzone>
 *   {({getRootProps, getInputProps}) => (
 *     <div {...getRootProps()}>
 *       <input {...getInputProps()} />
 *       <p>Drag 'n' drop some files here, or click to select files</p>
 *     </div>
 *   )}
 * </Dropzone>
 * ```
 */
const Dropzone = forwardRef<React.RefAttributes<DropzoneRef>, DropzoneProps>(
  ({ children, ...params }, ref) => {
    const { open, ...props } = useDropzone(params);

    // @ts-ignore
    useImperativeHandle(ref, () => ({ open }), [open]);

    // TODO: Figure out why react-styleguidist cannot create docs if we don't return a jsx element
    return <Fragment>{children({ ...props, open })}</Fragment>;
  },
);

Dropzone.displayName = 'Dropzone';

// Add default props for react-docgen
const defaultProps = {
  disabled: false,
  getFilesFromEvent: fromEvent,
  maxSize: Infinity,
  minSize: 0,
  multiple: true,
  maxFiles: 0,
  preventDropOnDocument: true,
  noClick: false,
  noKeyboard: false,
  noDrag: false,
  noDragEventsBubbling: false,
  validator: null as any,
  useFsAccessApi: true,
  autoFocus: false,
};

Dropzone.defaultProps = defaultProps;

export default Dropzone;

/**
 * A function that is invoked for the `dragenter`,
 * `dragover` and `dragleave` events.
 * It is not invoked if the items are not files (such as link, text, etc.).
 *
 * @callback dragCb
 * @param {DragEvent} event
 */

/**
 * A function that is invoked for the `drop` or input change event.
 * It is not invoked if the items are not files (such as link, text, etc.).
 *
 * @callback dropCb
 * @param {File[]} acceptedFiles List of accepted files
 * @param {FileRejection[]} fileRejections List of rejected files and why they were rejected
 * @param {(DragEvent|Event)} event A drag event or input change event (if files were selected via the file dialog)
 */

/**
 * A function that is invoked for the `drop` or input change event.
 * It is not invoked if the items are files (such as link, text, etc.).
 *
 * @callback dropAcceptedCb
 * @param {File[]} files List of accepted files that meet the given criteria
 * (`accept`, `multiple`, `minSize`, `maxSize`)
 * @param {(DragEvent|Event)} event A drag event or input change event (if files were selected via the file dialog)
 */

/**
 * A function that is invoked for the `drop` or input change event.
 *
 * @callback dropRejectedCb
 * @param {File[]} files List of rejected files that do not meet the given criteria
 * (`accept`, `multiple`, `minSize`, `maxSize`)
 * @param {(DragEvent|Event)} event A drag event or input change event (if files were selected via the file dialog)
 */

/**
 * A function that is used aggregate files,
 * in a asynchronous fashion, from drag or input change events.
 *
 * @callback getFilesFromEvent
 * @param {(DragEvent|Event)} event A drag event or input change event (if files were selected via the file dialog)
 * @returns {(File[]|Promise<File[]>)}
 */

/**
 * An object with the current dropzone state.
 *
 * @typedef {object} DropzoneState
 * @property {boolean} isFocused Dropzone area is in focus
 * @property {boolean} isFileDialogActive File dialog is opened
 * @property {boolean} isDragActive Active drag is in progress
 * @property {boolean} isDragAccept Dragged files are accepted
 * @property {boolean} isDragReject Some dragged files are rejected
 * @property {File[]} acceptedFiles Accepted files
 * @property {FileRejection[]} fileRejections Rejected files and why they were rejected
 */

/**
 * An object with the dropzone methods.
 *
 * @typedef {object} DropzoneMethods
 * @property {Function} getRootProps Returns the props you should apply to the root drop container you render
 * @property {Function} getInputProps Returns the props you should apply to hidden file input you render
 * @property {Function} open Open the native file selection dialog
 */

const initialState = {
  isFocused: false,
  isFileDialogActive: false,
  isDragActive: false,
  isDragAccept: false,
  isDragReject: false,
  acceptedFiles: [],
  fileRejections: [],
};

/**
 * A React hook that creates a drag 'n' drop area.
 *
 * ```jsx
 * function MyDropzone(props) {
 *   const {getRootProps, getInputProps} = useDropzone({
 *     onDrop: acceptedFiles => {
 *       // do something with the File objects, e.g. upload to some server
 *     }
 *   });
 *   return (
 *     <div {...getRootProps()}>
 *       <input {...getInputProps()} />
 *       <p>Drag and drop some files here, or click to select files</p>
 *     </div>
 *   )
 * }
 * ```
 *
 * @function useDropzone
 *
 * @param {object} props
 * @param {import("./utils").AcceptProp} [props.accept] Set accepted file types.
 * Checkout https://developer.mozilla.org/en-US/docs/Web/API/window/showOpenFilePicker types option for more information.
 * Keep in mind that mime type determination is not reliable across platforms. CSV files,
 * for example, are reported as text/plain under macOS but as application/vnd.ms-excel under
 * Windows. In some cases there might not be a mime type set at all (https://github.com/react-dropzone/react-dropzone/issues/276).
 * @param {boolean} [props.multiple=true] Allow drag 'n' drop (or selection from the file dialog) of multiple files
 * @param {boolean} [props.preventDropOnDocument=true] If false, allow dropped items to take over the current browser window
 * @param {boolean} [props.noClick=false] If true, disables click to open the native file selection dialog
 * @param {boolean} [props.noKeyboard=false] If true, disables SPACE/ENTER to open the native file selection dialog.
 * Note that it also stops tracking the focus state.
 * @param {boolean} [props.noDrag=false] If true, disables drag 'n' drop
 * @param {boolean} [props.noDragEventsBubbling=false] If true, stops drag event propagation to parents
 * @param {number} [props.minSize=0] Minimum file size (in bytes)
 * @param {number} [props.maxSize=Infinity] Maximum file size (in bytes)
 * @param {boolean} [props.disabled=false] Enable/disable the dropzone
 * @param {getFilesFromEvent} [props.getFilesFromEvent] Use this to provide a custom file aggregator
 * @param {Function} [props.onFileDialogCancel] Cb for when closing the file dialog with no selection
 * @param {boolean} [props.useFsAccessApi] Set to true to use the https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 * to open the file picker instead of using an `<input type="file">` click event.
 * @param {boolean} autoFocus Set to true to auto focus the root element.
 * @param {Function} [props.onFileDialogOpen] Cb for when opening the file dialog
 * @param {dragCb} [props.onDragEnter] Cb for when the `dragenter` event occurs.
 * @param {dragCb} [props.onDragLeave] Cb for when the `dragleave` event occurs
 * @param {dragCb} [props.onDragOver] Cb for when the `dragover` event occurs
 * @param {dropCb} [props.onDrop] Cb for when the `drop` event occurs.
 * Note that this callback is invoked after the `getFilesFromEvent` callback is done.
 *
 * Files are accepted or rejected based on the `accept`, `multiple`, `minSize` and `maxSize` props.
 * `accept` must be an object with keys as a valid [MIME type](http://www.iana.org/assignments/media-types/media-types.xhtml) according to [input element specification](https://www.w3.org/wiki/HTML/Elements/input/file) and the value an array of file extensions (optional).
 * If `multiple` is set to false and additional files are dropped,
 * all files besides the first will be rejected.
 * Any file which does not have a size in the [`minSize`, `maxSize`] range, will be rejected as well.
 *
 * Note that the `onDrop` callback will always be invoked regardless if the dropped files were accepted or rejected.
 * If you'd like to react to a specific scenario, use the `onDropAccepted`/`onDropRejected` props.
 *
 * `onDrop` will provide you with an array of [File](https://developer.mozilla.org/en-US/docs/Web/API/File) objects which you can then process and send to a server.
 * For example, with [SuperAgent](https://github.com/visionmedia/superagent) as a http/ajax library:
 *
 * ```js
 * function onDrop(acceptedFiles) {
 *   const req = request.post('/upload')
 *   acceptedFiles.forEach(file => {
 *     req.attach(file.name, file)
 *   })
 *   req.end(callback)
 * }
 * ```
 * @param {dropAcceptedCb} [props.onDropAccepted]
 * @param {dropRejectedCb} [props.onDropRejected]
 * @param {(error: Error) => void} [props.onError]
 *
 * @returns {DropzoneState & DropzoneMethods}
 */
export function useDropzone(props: DropzoneOptions = {}): DropzoneState {
  const {
    accept,
    disabled,
    getFilesFromEvent,
    maxSize,
    minSize,
    multiple,
    maxFiles,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
    onDropAccepted,
    onDropRejected,
    onFileDialogCancel,
    onFileDialogOpen,
    useFsAccessApi,
    autoFocus,
    preventDropOnDocument,
    noClick,
    noKeyboard,
    noDrag,
    noDragEventsBubbling,
    onError,
    validator,
  } = {
    ...defaultProps,
    ...props,
  };

  const acceptAttr = useMemo(() => acceptPropAsAcceptAttr(accept!), [accept]);
  const pickerTypes = useMemo(() => pickerOptionsFromAccept(accept), [accept]);

  const onFileDialogOpenCb = useMemo(
    () => (typeof onFileDialogOpen === 'function' ? onFileDialogOpen : noop),
    [onFileDialogOpen],
  );
  const onFileDialogCancelCb = useMemo(
    () => (typeof onFileDialogCancel === 'function' ? onFileDialogCancel : noop),
    [onFileDialogCancel],
  );

  /**
   * @constant
   * @type {React.MutableRefObject<HTMLElement>}
   */
  const rootRef = useRef<any>(null);

  const inputRef = useRef<any>(null);

  const [state, dispatch] = useReducer(reducer, initialState);
  const { isFocused, isFileDialogActive } = state;

  const fsAccessApiWorksRef = useRef(
    typeof window !== 'undefined' &&
      window.isSecureContext &&
      useFsAccessApi &&
      canUseFileSystemAccessAPI(),
  );

  // Update file dialog active state when the window is focused on
  const onWindowFocus = () => {
    // Execute the timeout only if the file dialog is opened in the browser
    if (!fsAccessApiWorksRef.current && isFileDialogActive) {
      setTimeout(() => {
        if (inputRef.current) {
          const { files } = inputRef.current;

          if (!files.length) {
            dispatch({ type: 'closeDialog' });
            onFileDialogCancelCb();
          }
        }
      }, 300);
    }
  };
  useEffect(() => {
    window.addEventListener('focus', onWindowFocus, false);
    return () => {
      window.removeEventListener('focus', onWindowFocus, false);
    };
  }, [inputRef, isFileDialogActive, onFileDialogCancelCb, fsAccessApiWorksRef]);

  const dragTargetsRef = useRef<any[]>([]);
  const onDocumentDrop = (event: any) => {
    if (rootRef.current && rootRef.current.contains(event.target)) {
      // If we intercepted an event for our instance, let it propagate down to the instance's onDrop handler
      return;
    }
    event.preventDefault();
    dragTargetsRef.current = [];
  };

  useEffect(() => {
    if (preventDropOnDocument) {
      document.addEventListener('dragover', onDocumentDragOver, false);
      document.addEventListener('drop', onDocumentDrop, false);
    }

    return () => {
      if (preventDropOnDocument) {
        document.removeEventListener('dragover', onDocumentDragOver);
        document.removeEventListener('drop', onDocumentDrop);
      }
    };
  }, [rootRef, preventDropOnDocument]);

  // Auto focus the root when autoFocus is true
  useEffect(() => {
    if (!disabled && autoFocus && rootRef.current) {
      rootRef.current.focus();
    }
    return () => {};
  }, [rootRef, autoFocus, disabled]);

  const onErrCb = useCallback(
    (e: any) => {
      if (onError) {
        onError(e);
      } else {
        // Let the user know something's gone wrong if they haven't provided the onError cb.
        console.error(e);
      }
    },
    [onError],
  );

  const onDragEnterCb = useCallback(
    (event: any) => {
      event.preventDefault();
      // Persist here because we need the event later after getFilesFromEvent() is done
      event.persist();
      stopPropagation(event);

      dragTargetsRef.current = [...dragTargetsRef.current, event.target];

      if (isEvtWithFiles(event)) {
        Promise.resolve(getFilesFromEvent(event))
          .then((files) => {
            if (isPropagationStopped(event) && !noDragEventsBubbling) {
              return;
            }

            const fileCount = files.length;
            const isDragAccept =
              fileCount > 0 &&
              allFilesAccepted({
                files,
                accept: acceptAttr,
                minSize,
                maxSize,
                multiple,
                maxFiles,
                validator,
              });
            const isDragReject = fileCount > 0 && !isDragAccept;

            dispatch({
              isDragAccept,
              isDragReject,
              isDragActive: true,
              type: 'setDraggedFiles',
            });

            if (onDragEnter) {
              onDragEnter(event);
            }
          })
          .catch((e) => onErrCb(e));
      }
    },
    [
      getFilesFromEvent,
      onDragEnter,
      onErrCb,
      noDragEventsBubbling,
      acceptAttr,
      minSize,
      maxSize,
      multiple,
      maxFiles,
      validator,
    ],
  );

  const onDragOverCb = useCallback(
    (event: any) => {
      event.preventDefault();
      event.persist();
      stopPropagation(event);

      const hasFiles = isEvtWithFiles(event);
      if (hasFiles && event.dataTransfer) {
        try {
          event.dataTransfer.dropEffect = 'copy';
        } catch {} /* eslint-disable-line no-empty */
      }

      if (hasFiles && onDragOver) {
        onDragOver(event);
      }

      return false;
    },
    [onDragOver, noDragEventsBubbling],
  );

  const onDragLeaveCb = useCallback(
    (event: any) => {
      event.preventDefault();
      event.persist();
      stopPropagation(event);

      // Only deactivate once the dropzone and all children have been left
      const targets = dragTargetsRef.current.filter(
        (target) => rootRef.current && rootRef.current.contains(target),
      );
      // Make sure to remove a target present multiple times only once
      // (Firefox may fire dragenter/dragleave multiple times on the same element)
      const targetIdx = targets.indexOf(event.target);
      if (targetIdx !== -1) {
        targets.splice(targetIdx, 1);
      }
      dragTargetsRef.current = targets;
      if (targets.length > 0) {
        return;
      }

      dispatch({
        type: 'setDraggedFiles',
        isDragActive: false,
        isDragAccept: false,
        isDragReject: false,
      });

      if (isEvtWithFiles(event) && onDragLeave) {
        onDragLeave(event);
      }
    },
    [rootRef, onDragLeave, noDragEventsBubbling],
  );

  const setFiles = useCallback(
    (files: any[], event: any) => {
      const acceptedFiles: any[] = [];
      const fileRejections: any[] = [];

      files.forEach((file) => {
        const [accepted, acceptError] = fileAccepted(file, acceptAttr);
        const [sizeMatch, sizeError] = fileMatchSize(file, minSize, maxSize);
        const customErrors = validator ? validator(file) : null;

        if (accepted && sizeMatch && !customErrors) {
          acceptedFiles.push(file);
        } else {
          let errors = [acceptError, sizeError];

          if (customErrors) {
            errors = errors.concat(customErrors);
          }

          fileRejections.push({ file, errors: errors.filter((e) => e) });
        }
      });

      if (
        (!multiple && acceptedFiles.length > 1) ||
        (multiple && maxFiles >= 1 && acceptedFiles.length > maxFiles)
      ) {
        // Reject everything and empty accepted files
        acceptedFiles.forEach((file) => {
          fileRejections.push({ file, errors: [TOO_MANY_FILES_REJECTION] });
        });
        acceptedFiles.splice(0);
      }

      dispatch({
        acceptedFiles,
        fileRejections,
        type: 'setFiles',
      });

      if (onDrop) {
        onDrop(acceptedFiles, fileRejections, event);
      }

      if (fileRejections.length > 0 && onDropRejected) {
        onDropRejected(fileRejections, event);
      }

      if (acceptedFiles.length > 0 && onDropAccepted) {
        onDropAccepted(acceptedFiles, event);
      }
    },
    [
      dispatch,
      multiple,
      acceptAttr,
      minSize,
      maxSize,
      maxFiles,
      onDrop,
      onDropAccepted,
      onDropRejected,
      validator,
    ],
  );

  const onDropCb = useCallback(
    (event: any) => {
      event.preventDefault();
      // Persist here because we need the event later after getFilesFromEvent() is done
      event.persist();
      stopPropagation(event);

      dragTargetsRef.current = [];

      if (isEvtWithFiles(event)) {
        Promise.resolve(getFilesFromEvent(event))
          .then((files) => {
            if (isPropagationStopped(event) && !noDragEventsBubbling) {
              return;
            }
            setFiles(files, event);
          })
          .catch((e) => onErrCb(e));
      }
      dispatch({ type: 'reset' });
    },
    [getFilesFromEvent, setFiles, onErrCb, noDragEventsBubbling],
  );

  // Fn for opening the file dialog programmatically
  const openFileDialog = useCallback(() => {
    // No point to use FS access APIs if context is not secure
    // https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts#feature_detection
    if (fsAccessApiWorksRef.current) {
      dispatch({ type: 'openDialog' });
      onFileDialogOpenCb();
      // https://developer.mozilla.org/en-US/docs/Web/API/window/showOpenFilePicker
      const opts = {
        multiple,
        types: pickerTypes,
      };
      (window as any)
        .showOpenFilePicker(opts)
        .then((handles: any) => getFilesFromEvent(handles))
        .then((files: any[]) => {
          setFiles(files, null);
          dispatch({ type: 'closeDialog' });
        })
        .catch((e: any) => {
          // AbortError means the user canceled
          if (isAbort(e)) {
            onFileDialogCancelCb(e);
            dispatch({ type: 'closeDialog' });
          } else if (isSecurityError(e)) {
            fsAccessApiWorksRef.current = false;
            // CORS, so cannot use this API
            // Try using the input
            if (inputRef.current) {
              inputRef.current.value = null;
              inputRef.current.click();
            } else {
              onErrCb(
                new Error(
                  'Cannot open the file picker because the https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API is not supported and no <input> was provided.',
                ),
              );
            }
          } else {
            onErrCb(e);
          }
        });
      return;
    }

    if (inputRef.current) {
      dispatch({ type: 'openDialog' });
      onFileDialogOpenCb();
      inputRef.current.value = null;
      inputRef.current.click();
    }
  }, [
    dispatch,
    onFileDialogOpenCb,
    onFileDialogCancelCb,
    useFsAccessApi,
    setFiles,
    onErrCb,
    pickerTypes,
    multiple,
  ]);

  // Cb to open the file dialog when SPACE/ENTER occurs on the dropzone
  const onKeyDownCb = useCallback(
    (event: any) => {
      // Ignore keyboard events bubbling up the DOM tree
      if (!rootRef.current || !rootRef.current.isEqualNode(event.target)) {
        return;
      }

      if (
        event.key === ' ' ||
        event.key === 'Enter' ||
        event.keyCode === 32 ||
        event.keyCode === 13
      ) {
        event.preventDefault();
        openFileDialog();
      }
    },
    [rootRef, openFileDialog],
  );

  // Update focus state for the dropzone
  const onFocusCb = useCallback(() => {
    dispatch({ type: 'focus' });
  }, []);
  const onBlurCb = useCallback(() => {
    dispatch({ type: 'blur' });
  }, []);

  // Cb to open the file dialog when click occurs on the dropzone
  const onClickCb = useCallback(() => {
    if (noClick) {
      return;
    }

    // In IE11/Edge the file-browser dialog is blocking, therefore, use setTimeout()
    // to ensure React can handle state changes
    // See: https://github.com/react-dropzone/react-dropzone/issues/450
    if (isIeOrEdge()) {
      setTimeout(openFileDialog, 0);
    } else {
      openFileDialog();
    }
  }, [noClick, openFileDialog]);

  const composeHandler = (fn: any) => {
    return disabled ? null : fn;
  };

  const composeKeyboardHandler = (fn: any) => {
    return noKeyboard ? null : composeHandler(fn);
  };

  const composeDragHandler = (fn: any) => {
    return noDrag ? null : composeHandler(fn);
  };

  const stopPropagation = (event: any) => {
    if (noDragEventsBubbling) {
      event.stopPropagation();
    }
  };

  const getRootProps = useMemo(
    () =>
      ({
        refKey = 'ref',
        role,
        onKeyDown,
        onFocus,
        onBlur,
        onClick,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        ...rest
      }: DropzoneRootProps = {}) => ({
        onKeyDown: composeKeyboardHandler(composeEventHandlers(onKeyDown, onKeyDownCb)),
        onFocus: composeKeyboardHandler(composeEventHandlers(onFocus, onFocusCb)),
        onBlur: composeKeyboardHandler(composeEventHandlers(onBlur, onBlurCb)),
        onClick: composeHandler(composeEventHandlers(onClick, onClickCb)),
        onDragEnter: composeDragHandler(composeEventHandlers(onDragEnter, onDragEnterCb)),
        onDragOver: composeDragHandler(composeEventHandlers(onDragOver, onDragOverCb)),
        onDragLeave: composeDragHandler(composeEventHandlers(onDragLeave, onDragLeaveCb)),
        onDrop: composeDragHandler(composeEventHandlers(onDrop, onDropCb)),
        role: typeof role === 'string' && role !== '' ? role : 'presentation',
        [refKey]: rootRef,
        ...(!disabled && !noKeyboard ? { tabIndex: 0 } : {}),
        ...rest,
      }),
    [
      rootRef,
      onKeyDownCb,
      onFocusCb,
      onBlurCb,
      onClickCb,
      onDragEnterCb,
      onDragOverCb,
      onDragLeaveCb,
      onDropCb,
      noKeyboard,
      noDrag,
      disabled,
    ],
  );

  const onInputElementClick = useCallback((event: any) => {
    event.stopPropagation();
  }, []);

  const getInputProps: DropzoneRootProps = useMemo(
    () =>
      ({ refKey = 'ref', onChange, onClick, ...rest }: DropzoneRootProps = {}) => {
        const inputProps = {
          accept: acceptAttr,
          multiple,
          type: 'file',
          style: { display: 'none' },
          onChange: composeHandler(composeEventHandlers(onChange, onDropCb)),
          onClick: composeHandler(composeEventHandlers(onClick, onInputElementClick)),
          tabIndex: -1,
          [refKey]: inputRef,
        };

        return {
          ...inputProps,
          ...rest,
        };
      },
    [inputRef, accept, multiple, onDropCb, disabled],
  );

  return {
    ...state,
    isFocused: isFocused && !disabled,
    getRootProps,
    getInputProps,
    rootRef,
    inputRef,
    open: composeHandler(openFileDialog),
  };
}

/**
 * @param {DropzoneState} state
 * @param {{type: string} & DropzoneState} action
 * @returns {DropzoneState}
 */
function reducer(state: any, action: any) {
  /* istanbul ignore next */
  switch (action.type) {
    case 'focus':
      return {
        ...state,
        isFocused: true,
      };
    case 'blur':
      return {
        ...state,
        isFocused: false,
      };
    case 'openDialog':
      return {
        ...initialState,
        isFileDialogActive: true,
      };
    case 'closeDialog':
      return {
        ...state,
        isFileDialogActive: false,
      };
    case 'setDraggedFiles':
      return {
        ...state,
        isDragActive: action.isDragActive,
        isDragAccept: action.isDragAccept,
        isDragReject: action.isDragReject,
      };
    case 'setFiles':
      return {
        ...state,
        acceptedFiles: action.acceptedFiles,
        fileRejections: action.fileRejections,
      };
    case 'reset':
      return {
        ...initialState,
      };
    default:
      return state;
  }
}

function noop(e?: any) {}
