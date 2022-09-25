import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {catchError, EMPTY, Observable} from "rxjs";
import {Router} from "@angular/router";
import {CookieService} from "ngx-cookie-service";

@Injectable()
export class ErrorInterceptor implements HttpInterceptor{

  constructor(private router: Router, private cookie: CookieService) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError(err => {
        if (err.status === 400) {
          this.cookie.delete('spotify_token');
          this.router.navigate(['/']);
        }
        return EMPTY;
      })
    )
  }

}
