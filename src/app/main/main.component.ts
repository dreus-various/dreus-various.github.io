import {Component, OnInit} from "@angular/core";
import {CookieService} from "ngx-cookie-service";
import {Router} from "@angular/router";
import {SpotifyService} from "./spotify.service";

import tokensMap from '../../assets/tokens_map.json';

@Component({
  selector: 'main',
  templateUrl: './main.component.html',
  styleUrls: ['main.component.css']
})
export class MainComponent implements OnInit {

  public loading: boolean = false;

  public listOfTracks: any[] = [];

  private filterActions = {
    'energetic': (trackInfo: { energy: number }): boolean => trackInfo.energy >= 0.5,
    'calm': (trackInfo: { energy: number }): boolean => trackInfo.energy <= 0.5,
    'happy': (trackInfo: { valence: number }): boolean => trackInfo.valence >= 0.5,
    'sad': (trackInfo: { valence: number }): boolean => trackInfo.valence <= 0.5,
    'popular': (trackInfo: { popularity: number }): boolean => trackInfo.popularity >= 50,
  }

  public loadingPercent: number = 0;

  constructor(private cookie: CookieService, private router: Router, private spotifyService: SpotifyService) {
  }

  public ngOnInit() {
    console.log('Version 0.2 disliked songs');
    let spotifyToken = this.cookie.get('spotify_token');
    if (!spotifyToken) {
      this.router.navigate(['/']);
    }
    this.spotifyService.getUserInfo().subscribe(res => {
      this.spotifyService.setUserId(res.id)
    });
  }

  public async test() {
    let array: {token: string, hits: number, searchNumberMin: number, searchNumberMax: number}[] = [];

    for (let tokensMapKey in tokensMap) {
      // @ts-ignore
      array.push({token: tokensMapKey, hits: tokensMap[tokensMapKey], searchNumberMin: 0, searchNumberMax: 0})
    }

    array = array
      .sort((a, b) => b.hits - a.hits);

    const sum: number = array
      .reduce((prev: number, curr: {hits: number}) => {
        prev += curr.hits;
        return prev;
      }, 0);

    let currentIndex = 0;

    array = array
      .map(val => {
        const newObj = {
          ...val,
          searchNumberMin: currentIndex + 1,
          searchNumberMax: currentIndex + val.hits
        };
        currentIndex += val.hits;
        return newObj;
      });

    for (let i = 0; i < 10; i++) {
      const randomValue = this.spotifyService.getRandomNumber(1, sum + 1);
      const randomToken = array.find(val => randomValue >= val.searchNumberMin && randomValue <= val.searchNumberMax);

      console.log(randomToken);
    }
  }

  public async justRadios() {
    this.loadingPercent = 0;
    this.loading = true;

    let randomRadios = await this.spotifyService.getPlaylistByName('Just radios');
    if (!randomRadios) {
      randomRadios = await this.spotifyService.saveNewPlaylist('Just radios', '');
    }
    await this.spotifyService.deleteAllSong(randomRadios);

    let offset = 0;

    let playlists = await this.spotifyService.getPlaylists(offset);
    let radioPlaylists: any[] = [];
    while (playlists.items.length !== 0) {
      for (let playlist of playlists.items) {
        if (playlist.name.includes('Radio')) {
          radioPlaylists.push(playlist);
        }
      }
      offset += 50;
      playlists = await this.spotifyService.getPlaylists(offset);
    }

    this.shuffle(radioPlaylists);
    console.log('Radio playlists length');
    console.log(radioPlaylists.length);

    const tracksSet = new Set<any>();

    while (tracksSet.size < 2000) {
      let randomNumber = this.spotifyService.getRandomNumber(0, radioPlaylists.length - 1);
      const currentPlaylist = await this.spotifyService.getPlaylist(radioPlaylists[randomNumber].id);
      if (!currentPlaylist) {
        continue;
      }
      console.log(`using: ${currentPlaylist.name}`);

      const tracks: { uri: string }[] = currentPlaylist.tracks.items.map((item: any) => ({uri: item.track.uri}));
      tracks.forEach(track => tracksSet.add(track.uri));

      let percentValue = tracksSet.size / 2000 * 100;
      this.loadingPercent = percentValue >= 100 ? 100 : percentValue;
    }

    const tracks = this.shuffle(Array.from(tracksSet));

    let index = 0;
    const step = 100;
    let nextBatch = this.getNext(index, step, tracks);

    while (nextBatch.length !== 0) {
      await this.spotifyService.addToPlaylist(randomRadios.id, nextBatch);
      index += step;
      nextBatch = this.getNext(index, step, tracks);
    }

    this.loading = false;
  }

  private getNext(offset: number, limit: number, arr: string[]): string[] {
    return arr.slice(offset, offset + limit);
  }

  public async combineDailyMixes() {
    this.loading = true;

    let combinedPlaylist = await this.spotifyService.getPlaylistByName('Combined daily mix');
    if (!combinedPlaylist) {
      combinedPlaylist = await this.spotifyService.saveNewPlaylist('Combined daily mix', '');
    }
    await this.spotifyService.deleteAllSong(combinedPlaylist);

    let tracks: string[] = [];
    let offset = 0;

    let playlists = await this.spotifyService.getPlaylists(offset);

    while (playlists.items.length !== 0) {
      for (let playlistItem of playlists.items) {
        if (playlistItem.name.includes('Daily Mix') || playlistItem.name.includes('Discover Weekly')) {
          const dailyPlaylist = await this.spotifyService.getPlaylist(playlistItem.id);
          const tracksIds = dailyPlaylist.tracks.items.map((item: any) => item.track.uri);

          tracks.push(...tracksIds);
        }
      }

      offset += 50;
      playlists = await this.spotifyService.getPlaylists(offset);
    }

    tracks = this.shuffle(tracks);

    let index = 0;
    const step = 100;
    let nextBatch = this.getNext(index, step, tracks);

    while (nextBatch.length !== 0) {
      await this.spotifyService.addToPlaylist(combinedPlaylist.id, nextBatch);
      index += step;
      nextBatch = this.getNext(index, step, tracks);
    }

    this.loading = false;
  }

  public async generatePlaylist() {
    this.loadingPercent = 0;
    this.loading = true;

    let randomRadios = await this.spotifyService.getPlaylistByName('Super random');
    if (!randomRadios) {
      randomRadios = await this.spotifyService.saveNewPlaylist('Super random', '');
    }
    await this.spotifyService.deleteAllSong(randomRadios);

    let offset = 0;

    let playlists = await this.spotifyService.getPlaylists(offset);

    let dislikePlaylist: any;
    let combinedMixes: any;

    let radioPlaylists: any[] = [];

    while (playlists.items.length !== 0) {
      for (let playlist of playlists.items) {
        if (playlist.name.includes('Radio')) {
          radioPlaylists.push(playlist);
        }
        if (playlist.name === 'Disliked Songs') {
          dislikePlaylist = playlist;
        }
        if (playlist.name === 'Combined daily mix') {
          combinedMixes = playlist;
        }
      }

      offset += 50;
      playlists = await this.spotifyService.getPlaylists(offset);
    }

    const tracksSet = new Set<any>();

    const dislikedTracks = dislikePlaylist ? await this.spotifyService.getAllPlaylistTracks(dislikePlaylist.id) : [];

    if (combinedMixes) {
      let combinedMixesTracks = await this.spotifyService.getAllPlaylistTracks(combinedMixes.id);
      combinedMixesTracks.filter(item => !dislikedTracks.some(dislikedTrack => dislikedTrack === item))
        .forEach(item => tracksSet.add(item));
    }

    this.shuffle(radioPlaylists);

    console.log('Radio playlists length');
    console.log(radioPlaylists.length);

    while (tracksSet.size < 500) {
      let randomNumber = this.spotifyService.getRandomNumber(0, radioPlaylists.length - 1);
      const currentPlaylist = await this.spotifyService.getPlaylist(radioPlaylists[randomNumber].id);
      console.log('using:');
      console.log(currentPlaylist.name);
      const tracks: { uri: string }[] = currentPlaylist.tracks.items.map((item: any) => ({uri: item.track.uri}))
        .filter((track: {uri: string}) => !dislikedTracks.some(dislikedTrack => dislikedTrack === track.uri))

      const randomElements = this.spotifyService.getRandomElements(4, tracks);
      randomElements.forEach(randomElement => tracksSet.add(randomElement.uri));
      tracksSet.add(tracks[0].uri);

      let percentValue = tracksSet.size / 500 * 100;
      this.loadingPercent = percentValue >= 100 ? 100 : percentValue;
    }

    const tracks = this.shuffle(Array.from(tracksSet));

    let index = 0;
    const step = 100;
    let nextBatch = this.getNext(index, step, tracks);

    while (nextBatch.length !== 0) {
      await this.spotifyService.addToPlaylist(randomRadios.id, nextBatch);
      index += step;
      nextBatch = this.getNext(index, step, tracks);
    }

    this.loading = false;
  }

  public async getAudioFeatures(mode: ModeType) {
    this.loading = true;

    let resultPlaylist = await this.spotifyService.getPlaylistByName(`Super random ${mode}`);
    if (!resultPlaylist) {
      resultPlaylist = await this.spotifyService.saveNewPlaylist(`Super random ${mode}`, '');
    }
    await this.spotifyService.deleteAllSong(resultPlaylist);

    const superRandom = await this.spotifyService.getPlaylistByName(`Super random`);

    const trackInfos: any[] = [];

    let offset = 0;

    let tracks = await this.spotifyService.getPlaylistTracks(superRandom.id, offset);

    while (tracks.items.length !== 0) {
      const infos = await this.spotifyService.getTrackInfo(tracks.items.map((item: { track: { id: string } }) => item.track.id));
      infos['audio_features'].forEach((info: any) => {
        const found = tracks.items.find((item: any) => item.track.id === info.id)
        if (found) {
          trackInfos.push({
            popularity: found.track.popularity,
            ...info
          })
        }
      });

      offset += 100;
      tracks = await this.spotifyService.getPlaylistTracks(superRandom.id, offset);
    }

    const tracksToSave = this.shuffle(trackInfos.filter(this.filterActions[mode]).map(info => info.uri));

    let index = 0;
    const step = 100;
    let nextBatch = this.getNext(index, step, tracksToSave);

    while (nextBatch.length !== 0) {
      await this.spotifyService.addToPlaylist(resultPlaylist.id, nextBatch);
      index += step;
      nextBatch = this.getNext(index, step, tracksToSave);
    }

    this.loading = false;
  }

  private shuffle(array: any[]): any[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

}

type ModeType = 'energetic' | 'calm' | 'happy' | 'sad' | 'popular';
