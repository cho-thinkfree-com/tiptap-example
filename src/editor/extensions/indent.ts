import { AllSelection, TextSelection, Transaction } from "prosemirror-state";
import type { Command, CommandProps } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { Node } from "prosemirror-model";

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType,
      outdent: () => ReturnType,
    }
  }
}

export const Indent = Extension.create({
  name: "indent",

  addOptions() {
    return {
      types: ["listItem", "paragraph", "heading"],
      minLevel: 0,
      maxLevel: 4, // feel free to increase
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            renderHTML: (attributes) => {
              return attributes.indent > this.options.minLevel
                ? { "data-indent": attributes.indent }
                : null;
            },
            parseHTML: (element) => {
              const indentLevel = Number(element.getAttribute("data-indent"));
              return indentLevel && indentLevel > this.options.minLevel
                ? indentLevel
                : null;
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const setNodeIndentMarkup = (tr: Transaction, pos: number, delta: number) => {
      const node = tr?.doc?.nodeAt(pos);
      if (node) {
        const nextLevel = (node.attrs.indent || 0) + delta;
        const { minLevel, maxLevel } = this.options;
        const indent =
          nextLevel < minLevel
            ? minLevel
            : nextLevel > maxLevel
            ? maxLevel
            : nextLevel;

        if (indent !== node.attrs.indent) {
          const { indent: oldIndent, ...currentAttrs } = node.attrs;
          const nodeAttrs = indent > minLevel ? { ...currentAttrs, indent } : currentAttrs;
          tr.setNodeMarkup(pos, node.type, nodeAttrs, node.marks);
        }
      }
      return tr;
    };

    const updateIndent = (delta: number): Command => ({ tr, state, dispatch }: CommandProps) => {
      const { selection } = state;
      tr = tr.setSelection(selection);
      if (selection instanceof TextSelection || selection instanceof AllSelection) {
        const { from, to } = selection;
        state.doc.nodesBetween(from, to, (node: Node, pos: number) => {
          if (this.options.types.includes(node.type.name)) {
            tr = setNodeIndentMarkup(tr, pos, delta);
            return false;
          }
        });
      } else {
        tr = setNodeIndentMarkup(tr, selection.from, delta);
      }
      if (tr.docChanged && dispatch) {
        dispatch(tr);
        return true;
      }
      return false;
    };

    return {
      indent: () => updateIndent(1),
      outdent: () => updateIndent(-1),
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      "Shift-Tab": () => this.editor.commands.outdent(),
    };
  },
});
