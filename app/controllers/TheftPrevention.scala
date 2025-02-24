package controllers

import lila.api.Context
import lila.app._
import lila.game.{ AnonCookie, Game => GameModel, Pov }
import play.api.mvc._

private[controllers] trait TheftPrevention { self: LilaController =>

  protected def PreventTheft(pov: Pov)(ok: => Fu[Result])(implicit ctx: Context): Fu[Result] =
    if (isTheft(pov)) {
      fuccess(Redirect(routes.Round.watcher(pov.gameId, pov.color.name)))
    } else ok

  protected def isTheft(pov: Pov)(implicit ctx: Context) = {
    pov.game.isNotationImport || pov.player.isAi || {
      (pov.player.userId, ctx.userId) match {
        case (Some(_), None)                    => true
        case (Some(playerUserId), Some(userId)) => playerUserId != userId
        case (None, Some(_))                    => true
        case (None, _) =>
          !lila.api.Mobile.Api.requested(ctx.req) &&
          !ctx.req.cookies.get(AnonCookie.name).exists(_.value == pov.playerId)
      }
    }
  }

  protected def isMyPov(pov: Pov)(implicit ctx: Context) = !isTheft(pov)

  protected def playablePovForReq(game: GameModel)(implicit ctx: Context) =
    (!game.isNotationImport && game.playableEvenPaused) ?? {
      ctx.userId
        .fold(
          ctx.req.cookies
            .get(AnonCookie.name)
            .map(_.value)
            .flatMap(game.player)
            .filterNot(_.hasUser)
        )(game.playerByUserId)
        .filterNot(_.isAi)
        .map { Pov(game, _) }
    }

  protected lazy val theftResponse = Unauthorized(
    jsonError(
      "This game requires authentication"
    )
  ) as JSON
}
