/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {
  export interface TerminalDataWriteEvent {
    readonly terminal: Terminal;
    readonly data: string;
  }

  export namespace window {
    export const onDidWriteTerminalData: Event<TerminalDataWriteEvent>;
  }
}
