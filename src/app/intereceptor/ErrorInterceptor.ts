import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {catchError, EMPTY, Observable, tap} from "rxjs";
import {Router} from "@angular/router";

@Injectable()
export class ErrorInterceptor implements HttpInterceptor{

  constructor(private router: Router) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError(err => {
        this.router.navigate(['/'])
        return EMPTY;
      })
    )
  }

}
