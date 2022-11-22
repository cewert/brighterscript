import type { WalkVisitor, WalkOptions } from '../astUtils/visitors';
import { WalkMode } from '../astUtils/visitors';
import type { Position, Range } from 'vscode-languageserver';
import { CancellationTokenSource } from 'vscode-languageserver';
import { InternalWalkMode } from '../astUtils/visitors';
import type { SymbolTable } from '../SymbolTable';
import type { BrsTranspileState } from './BrsTranspileState';
import type { TranspileResult } from '../interfaces';
import type { AnnotationExpression } from './Expression';
import util from '../util';

/**
 * A BrightScript AST node
 */
export abstract class AstNode {
    /**
     *  The starting and ending location of the node.
     **/
    public abstract range: Range;

    public abstract transpile(state: BrsTranspileState): TranspileResult;

    /**
     * When being considered by the walk visitor, this describes what type of element the current class is.
     */
    public visitMode = InternalWalkMode.visitStatements;

    public abstract walk(visitor: WalkVisitor, options: WalkOptions);

    /**
     * The parent node for this statement. This is set dynamically during `onFileValidate`, and should not be set directly.
     */
    public parent?: AstNode;

    /**
     * Certain expressions or statements can have a symbol table (such as blocks, functions, namespace bodies, etc).
     * If you're interested in getting the closest SymbolTable, use `getSymbolTable` instead.
     */
    public symbolTable?: SymbolTable;

    /**
     * Get the closest symbol table for this node. Should be overridden in children that directly contain a symbol table
     */
    public getSymbolTable(): SymbolTable {
        if (this.symbolTable) {
            return this.symbolTable;
        } else {
            return this.parent?.getSymbolTable();
        }
    }

    /**
     * Walk upward and return the first node that results in `true` from the matcher
     */
    public findAncestor<TNode extends AstNode = AstNode>(matcher: (node: AstNode) => boolean | undefined) {
        let node = this.parent;
        while (node) {
            if (matcher(node)) {
                return node as TNode;
            }
            node = node.parent;
        }
    }

    /**
     * Find the first child where the matcher evaluates to true.
     * @param matcher a function called for each node. If you return true, this function returns the specified node. If you return a node, that node is returned. all other return values continue the loop
     */
    public findChild<TNodeType extends AstNode = AstNode>(matcher: (node: AstNode) => boolean | AstNode, options?: WalkOptions) {
        const cancel = new CancellationTokenSource();
        let result: AstNode;
        this.walk((node) => {
            const matcherValue = matcher(node);
            if (matcherValue) {
                cancel.cancel();
                result = matcherValue === true ? node : matcherValue;
            }
        }, {
            walkMode: WalkMode.visitAllRecursive,
            ...options ?? {},
            cancel: cancel.token
        });
        return result as TNodeType;
    }

    /**
     * FInd the deepest child that includes the given position
     */
    public findChildAtPosition<TNodeType extends AstNode = AstNode>(position: Position, options?: WalkOptions): TNodeType {
        return this.findChild<TNodeType>((node) => {
            //if the current node includes this range, keep that node
            if (util.rangeContains(node.range, position)) {
                return node.findChildAtPosition(position, options) ?? node;
            }
        }, options);
    }
}

export abstract class Statement extends AstNode {
    /**
     * When being considered by the walk visitor, this describes what type of element the current class is.
     */
    public visitMode = InternalWalkMode.visitStatements;
    /**
     * Annotations for this statement
     */
    public annotations?: AnnotationExpression[];
}


/** A BrightScript expression */
export abstract class Expression extends AstNode {
    /**
     * When being considered by the walk visitor, this describes what type of element the current class is.
     */
    public visitMode = InternalWalkMode.visitExpressions;
}
