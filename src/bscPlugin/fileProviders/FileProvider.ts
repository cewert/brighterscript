import type { BeforeFileParseEvent, ProvideFileEvent } from '../../interfaces';
import { BrsFile } from '../../files/BrsFile';
import chalk from 'chalk';
import { LogLevel } from '../../Logger';
import { XmlFile } from '../../files/XmlFile';
import { util } from '../../util';

export class FileProvider {
    constructor(
        private event: ProvideFileEvent
    ) { }

    public process() {
        //if the event already has a file for this path, assume some other plugin has processed this event already
        if (this.event.files.find(x => x.srcPath === this.event.srcPath)) {
            return;
        }

        switch (this.event.srcExtension) {
            case '.brs':
            case '.bs':
                return this.handleBrsFile();
            case '.xml':
                return this.handleXmlFile();
            default:
            //TODO handle other file types
        }
    }

    private get logger() {
        return this.event.program.logger;
    }

    private handleBrsFile() {
        const file = new BrsFile(this.event.srcPath, this.event.pkgPath, this.event.program);
        const text = this.event.getFileData().toString();

        let parseEvent: BeforeFileParseEvent = {
            //TODO remove `pathAbsolute` in v1
            pathAbsolute: this.event.srcPath,
            srcPath: this.event.srcPath,
            source: text
        };
        this.event.program.plugins.emit('beforeFileParse', parseEvent);

        this.logger.time(LogLevel.debug, ['parse', chalk.green(this.event.srcPath)], () => {
            file.parse(parseEvent.source);
        });

        //notify plugins that this file has finished parsing
        this.event.program.plugins.emit('afterFileParse', file);

        this.event.files.push(file);
    }

    private handleXmlFile() {
        //only process files from the components folder (Roku will only parse xml files in the components folder)
        if (!/^(pkg:\/)?components[\/\\]/i.exec(this.event.pkgPath)) {
            return;
        }
        const text = this.event.getFileData().toString();
        //add the file to the program
        const file = new XmlFile(this.event.srcPath, this.event.pkgPath, this.event.program);

        let beforeFileParseEvent: BeforeFileParseEvent = {
            //TODO remove `pathAbsolute` in v1
            pathAbsolute: this.event.srcPath,
            srcPath: this.event.srcPath,
            source: text
        };
        this.event.program.plugins.emit('beforeFileParse', beforeFileParseEvent);

        this.logger.time(LogLevel.debug, ['parse', chalk.green(this.event.srcPath)], () => {
            file.parse(beforeFileParseEvent.source);
        });

        //notify plugins that this file has finished parsing
        this.event.program.plugins.emit('afterFileParse', file);

        this.event.files.push(file);
    }
}
