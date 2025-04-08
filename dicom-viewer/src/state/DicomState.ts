export class DicomState {
  private static currentFile: File | null = null;

  static setCurrentFile(file: File) {
    this.currentFile = file;
  }

  static getCurrentFile(): File | null {
    return this.currentFile;
  }
}
