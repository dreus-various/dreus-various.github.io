import {Component, OnInit} from "@angular/core";
import {CookieService} from "ngx-cookie-service";
import {Router} from "@angular/router";
import {SpotifyService} from "./spotify.service";

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
    console.log('Version 0.3 liked songs shuffle');
    let spotifyToken = this.cookie.get('spotify_token');
    if (!spotifyToken) {
      this.router.navigate(['/']);
    }
    this.spotifyService.getUserInfo().subscribe(res => {
      this.spotifyService.setUserId(res.id)
    });
  }

  public async mergeMixes() {
    this.loadingPercent = 0;
    this.loading = true;

    let mergedMixesPlaylist = await this.spotifyService.getPlaylistByName("Merged mixes");
    if (!mergedMixesPlaylist) {
      mergedMixesPlaylist = await this.spotifyService.saveNewPlaylist('Merged mixes', '');
    }
    await this.spotifyService.deleteAllSong(mergedMixesPlaylist);

    const tracksSet = new Set<string>();

    const userTracks = await this.spotifyService.getAllUserTrackUris();
    userTracks.forEach(track => tracksSet.add(track));

    let offset = 0;

    let playlists = await this.spotifyService.getPlaylists(offset);
    let mixes: any[] = [];

    while (playlists.items.length !== 0) {
      for (let playlist of playlists.items) {
        if (playlist.name.includes('Mix') || playlist.name.includes('Discover')) {
          mixes.push(playlist);
        }
      }
      offset += 50;
      playlists = await this.spotifyService.getPlaylists(offset);
    }

    for (let mix of mixes) {
      const detailedPlaylist = await this.spotifyService.getPlaylist(mix.id);
      if (!detailedPlaylist) {
        continue;
      }
      console.log(`Processing ${detailedPlaylist.name}`);

      detailedPlaylist.tracks.items.map((item: any) => item.track.uri)
        .forEach((uri: string) => tracksSet.add(uri));
    }

    const tracks: string[] = this.shuffle(Array.from(tracksSet));

    await this.saveTracksToPlaylist(tracks, mergedMixesPlaylist);
    this.loading = false;
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

    await this.saveTracksToPlaylist(tracks, randomRadios);
    this.loading = false;
  }

  public async likedSongs() {
    this.loading = true;
    this.loadingPercent = 0;

    let allLiked = await this.spotifyService.getPlaylistByName('All liked');
    if (!allLiked) {
      allLiked = await this.spotifyService.saveNewPlaylist('All liked', '');
    }
    await this.spotifyService.deleteAllSong(allLiked);

    const userTracks = await this.spotifyService.getAllUserTrackUris();

    this.shuffle(userTracks);
    this.loadingPercent = 100;

    await this.saveTracksToPlaylist(userTracks, allLiked);

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

    let randomRadios: {id: string} = await this.spotifyService.getPlaylistByName('Super random');
    if (!randomRadios) {
      randomRadios = await this.spotifyService.saveNewPlaylist('Super random', '');
    }
    await this.spotifyService.deleteAllSong(randomRadios);

    let offset = 0;

    let playlists = await this.spotifyService.getPlaylists(offset);

    let combinedMixes: any;
    let radioPlaylists: any[] = [];

    while (playlists.items.length !== 0) {
      for (let playlist of playlists.items) {
        if (playlist.name.includes('Radio')) {
          radioPlaylists.push(playlist);
        }
        if (playlist.name === 'Combined daily mix') {
          combinedMixes = playlist;
        }
      }

      offset += 50;
      playlists = await this.spotifyService.getPlaylists(offset);
    }

    const tracksSet = new Set<any>();

    if (combinedMixes) {
      let combinedMixesTracks = await this.spotifyService.getAllPlaylistTracks(combinedMixes.id);
      combinedMixesTracks
        .forEach(item => tracksSet.add(item));
    }

    this.shuffle(radioPlaylists);

    console.log('Radio playlists length');
    console.log(radioPlaylists.length);

    while (tracksSet.size < 600) {
      let randomNumber = this.spotifyService.getRandomNumber(0, radioPlaylists.length - 1);
      const currentPlaylist = await this.spotifyService.getPlaylist(radioPlaylists[randomNumber].id);
      console.log('using:');
      console.log(currentPlaylist.name);
      const tracks: { uri: string }[] = currentPlaylist.tracks.items.map((item: any) => ({uri: item.track.uri}));

      const randomElements = this.spotifyService.getRandomElements(5, tracks);
      randomElements.forEach(randomElement => tracksSet.add(randomElement.uri));
      tracksSet.add(tracks[0].uri);

      let percentValue = tracksSet.size / 600 * 100;
      this.loadingPercent = percentValue >= 100 ? 100 : percentValue;
    }

    const tracks = this.shuffle(Array.from(tracksSet));
    await this.saveTracksToPlaylist(tracks, randomRadios);

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

  private async saveTracksToPlaylist(tracks: string[], playlist: { id: string }): Promise<void> {
    let index = 0;
    const step = 100;
    let nextBatch = this.getNext(index, step, tracks);

    while (nextBatch.length !== 0) {
      await this.spotifyService.addToPlaylist(playlist.id, nextBatch);
      index += step;
      nextBatch = this.getNext(index, step, tracks);
    }
  }
}

type ModeType = 'energetic' | 'calm' | 'happy' | 'sad' | 'popular';
