import {Injectable} from "@angular/core";
import {mood} from "../model/mood.type";

@Injectable({providedIn: 'root'})
export class MoodService {

  public filterTracksByMood(tracks: {info: any}[], mood: mood): any[] {
    if (mood === 'Энергичное') {
      return tracks.filter(track => track.info.energy >= 0.6);
    }
    if (mood === 'Спокойное') {
      return tracks.filter(track => track.info.energy < 0.6);
    }
    if (mood === 'Весёлое') {
      return tracks.filter(track => track.info.valence >= 0.6);
    }
    if (mood === 'Грустное') {
      return tracks.filter(track => track.info.valence < 0.6);
    }
    return tracks;
  }
}
