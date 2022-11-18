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
  public filter: FilterType | null = null;

  public listOfTracks: any[] = [];

  private filterActions = {
    'energetic': (trackInfo: { energy: number, valence: number }): boolean => trackInfo.energy >= 0.5,
    'calm': (trackInfo: { energy: number, valence: number }): boolean => trackInfo.energy <= 0.5,
    'happy': (trackInfo: { energy: number, valence: number }): boolean => trackInfo.valence >= 0.5,
    'sad': (trackInfo: { energy: number, valence: number }): boolean => trackInfo.valence <= 0.5,
  }

  public loadingPercent: number = 0;

  constructor(private cookie: CookieService, private router: Router, private spotifyService: SpotifyService) {
  }

  public ngOnInit() {
    let spotifyToken = this.cookie.get('spotify_token');
    if (!spotifyToken) {
      this.router.navigate(['/']);
    }
    this.spotifyService.getUserInfo().subscribe(res => {
      this.spotifyService.setUserId(res.id)
    });
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

    await this.combineDailyMixes();

    this.loading = true;

    let randomRadios = await this.spotifyService.getPlaylistByName('Super random');
    if (!randomRadios) {
      randomRadios = await this.spotifyService.saveNewPlaylist('Super random', '');
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

    while (tracksSet.size < 200) {
      let randomNumber = this.spotifyService.getRandomNumber(0, radioPlaylists.length - 1);
      const currentPlaylist = await this.spotifyService.getPlaylist(radioPlaylists[randomNumber].id);
      console.log('using:');
      console.log(currentPlaylist.name);
      const tracks: { uri: string }[] = currentPlaylist.tracks.items.map((item: any) => ({uri: item.track.uri}));

      const randomElements = this.spotifyService.getRandomElements(9, tracks);
      randomElements.forEach(randomElement => tracksSet.add(randomElement.uri));
      tracksSet.add(tracks[0].uri)

      let percentValue = tracksSet.size / 200 * 100;
      this.loadingPercent = percentValue >= 100 ? 100 : percentValue;
    }

    const combinedDailyMix = await this.spotifyService.getPlaylistByName("Combined daily mix");
    if (combinedDailyMix) {
      offset = 0;
      let tracks = await this.spotifyService.getPlaylistTracks(combinedDailyMix.id, offset);

      while (tracks.items.length !== 0) {
        tracks.items.forEach((item: { track: { uri: string } }) => tracksSet.add(item.track.uri));
        offset += 50;
        tracks = await this.spotifyService.getPlaylistTracks(combinedDailyMix.id, offset);
      }
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

  private shuffle(array: any[]): any[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

}

type FilterType = 'energetic' | 'calm' | 'happy' | 'sad';
