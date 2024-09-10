import { Component, Input, OnInit } from '@angular/core';
import { Message } from '../model/message';
import { User } from '../model/user';
import * as moment from 'moment';

@Component({
  selector: 'app-chat-message',
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.scss'],
})
export class ChatMessageComponent implements OnInit {
  @Input() msg: Message = {} as Message;
  @Input() predecessor: Message | null = null;
  @Input() user: User = {} as User;
  @Input() allowsReply = false;

  constructor() {}

  ngOnInit() {}

  getDateDivider(msg: Message | undefined): string {
    // if (!msg.createdAt) {
    //   return null;
    // }
    //
    // return msg.createdAt.format('l');
    return '';
  }

  getUserName(user: User | undefined): string | null {
    if (!user) {
      return null;
    }
    return user.displayName;
  }

  getCreatedDate(msg: Message): string | null {
    if (!msg.createdAt) {
      return null;
    }
    // return msg.createdAt.format('LT');
    return '';
  }

  isPredecessorSameAuthor(): boolean {
    if (!this.predecessor) {
      return false;
    }
    return this.predecessor.uid === this.msg?.uid;
  }

  isTemporalClose(): boolean {
    if (!this.predecessor) {
      return true;
    }

    // const duration = moment.duration(
    //   this.msg?.createdAt.diff(this.predecessor.createdAt)
    // );
    // return duration.asMinutes() <= 1;
    return false;
  }

  isPreviousMessageFromOtherDay() {
    if (!this.predecessor) {
      return true;
    }
    // const prevDate = this.predecessor.createdAt.day();
    // const date = this.msg.createdAt.day();
    // return prevDate !== date;
    return false;
  }
}