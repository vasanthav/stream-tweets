// <reference path="https://github.com/sbergot/orgmodeserver/blob/master/src/ts/deps/EventSource.d.ts"/>
import { Component, OnInit, NgZone, Input } from '@angular/core';
import { FormGroup, FormArray, FormBuilder, Validators } from '@angular/forms';
import { Http } from '@angular/http';
import {EventSourcePolyfill} from 'ng-event-source';

// Type definitions for Server-Sent Events
// Specification: http://dev.w3.org/html5/eventsource/
// Definitions by: Yannik Hampe <https://github.com/yankee42>

declare var EventSource : sse.IEventSourceStatic;

declare module sse {

    /** The readyState attribute represents the state of the connection. */
    enum ReadyState {

        /** The connection has not yet been established, or it was closed and the user agent is reconnecting. */
        CONNECTING = 0,

        /** The user agent has an open connection and is dispatching events as it receives them. */
        OPEN = 1,

        /** The connection is not open, and the user agent is not trying to reconnect. Either there was a fatal error or the close() method was invoked. */
        CLOSED = 2
    }

    interface IEventSourceStatic {
        new (url: string, eventSourceInitDict?: IEventSourceInit): IEventSourceStatic;
        /** The serialisation of this EventSource object's url. */
        url: string;
        withCredentials: boolean;
        /** Always 0 */
        CONNECTING: ReadyState;
        /** Always 1 */
        OPEN: ReadyState;
        /** Always 2 */
        CLOSED: ReadyState;
        /** The ready state of the underlying connection. */
        readyState: ReadyState;
        onopen: (event: Event) => any;
        onmessage: (event: IOnMessageEvent) => void;
        onerror: (event: Event) => any;
        /** The close() method must abort any instances of the fetch algorithm started for this EventSource object, and must set the readyState attribute to CLOSED. */
        close: () => void;
        addEventListener: (type: string, h: (event: IOnMessageEvent) => void) => void;
        removeEventListener: (type: string, h: (event: IOnMessageEvent) => void) => void;
    }

    interface IEventSourceInit {
        /** Defines if request should set corsAttributeState to true.  */
        withCredentials?: boolean;
    }

    interface IOnMessageEvent {
        data: string;
    }
}

export class DropdownValue {
  value:string;
  label:string;

  constructor(value:string,label:string) {
    this.value = value;
    this.label = label;
  }
}

@Component({
  selector: 'my-app',
  templateUrl: `/app//app.html`,
})
export class AppComponent implements OnInit { 

  constructor(private http: Http, private _ngZone: NgZone, private _fb: FormBuilder) {}

  name: string = 'User'; 
  results: any = [];
  ws: any;
  error: string = '';
  langsAvailable: any[] = [];

  @Input()
  values: DropdownValue[] = [];
  filters: DropdownValue[] = [];
  myForm: any;

  ngOnInit() {
    this.myForm = this._fb.group({
            queryOptions: this._fb.array([
                this.initQuery(),
            ])
        });

    this.values.push(new DropdownValue('TWEET', 'Filter Tweet'));
    this.values.push(new DropdownValue('USER', 'Filter User'));
    this.values.push(new DropdownValue('LANG', 'Filter Language'));

    this.filters.push(new DropdownValue('CONTAINS', 'Match contains'));
    this.filters.push(new DropdownValue('EQUALS', 'Match equals to'));
    this.filters.push(new DropdownValue('REGEX', 'Match regex'));

    this.callTweets();
    this.getLangMap();
  }

  initQuery() {
    return this._fb.group({
            Field: [''],
            Operator: [''],
            Value: ['']
        });
  }

  addQuery() {
    const control = <FormArray>this.myForm.controls['queryOptions'];
    control.push(this.initQuery());
  }

  // TODO: this can be used for validation too
  getLangMap() {
    return this.http.get('/languages')
      .subscribe((response: any) => {
        this.langsAvailable = JSON.parse(response._body);
      },
      err => {
        console.log('ERROR getting langs');
      });
  }
  
  //TODO: Some way to lazy load stream results (to avoid page from hanging)
  callTweets() {
    let queryValue = this.myForm.controls.queryOptions._value;

    let filteredOptions = queryValue.filter((value: any) => (value.Field && value.Operator && value.Value));

    if (this.ws) {
      this.ws.close();
      this.error = '';
      this.results = []; // reset results
    }
    this.ws = new EventSource('/queryTweets?queryOptions=' + JSON.stringify(filteredOptions), { withCredentials: true });
      this.ws.onmessage = ((event: any) => {
        this._ngZone.run(() => {
          this.results.push(JSON.parse(event.data));
        });
      });

      this.ws.onerror = ((data: any) => {
        console.log('ERROR reading stream');
        this._ngZone.run(() => {
          this.error = 'Error connecting to stream, Please reload page';
        });
        this.ws.close();
      });
  }
}
