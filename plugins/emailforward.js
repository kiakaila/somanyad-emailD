var async = require("async");
var Domain = require("../../somanyad").Domain;
var Forward = require("../../somanyad").Forward;
var BlackReceiveList = require("../../somanyad").BlackReceiveList;
var EmailVerify = require("../../somanyad").EmailVerify;
var feePlan = require("../../somanyad").feePlan;
var m = require("moment");
var secrets = require("../../somanyad")secrets;

exports.forward = emailForward

// 获取真正转发目的地( 其实就是转发)
function emailForward (mail_from, rcpt_to, cb) {
	var toHost = rcpt_to.host;
  var toUser = rcpt_to.user;
  var fromHost = mail_from.host;
  // 如果是自己发出去的邮件,那么直接转发
  if (fromHost == secrets.sendMailDomain) {
    return cb(null);
  }
	// Check user's domain in db
	// 检测 to field 邮件地址的 host 是否位于数据库(或者域名)

  // 查看域名是否存在, 且通过验证
  function existVerifyDomain(done) {
    Domain.findOne({domain: rcpt_to.host, cnameVerifyStatus: true}, function (err, domain) {
      err = err || domain == null ? new Error("domain(" + rcpt_to.host + ") not found!") : null;
      done(err, domain);
    });
  }

  // 查看发送目的地(rcpt_to.user @ rcpt_to.host)是否处于废弃地址中
  function addressWasNotReject(domain, done) {
    // user: ObjectId,
    // // blockAddress@domain ==> email address
    // domain: ObjectId,
    // blockAddress: String,
    // replyInfo: String
    BlackReceiveList.findOne({domain: domain._id, blockAddress: rcpt_to.user}, function (err, blackRecord) {
      if (blackRecord) {
        err = new Error(blackRecord.replyInfo);
        return done(err);
      }
      done(err, domain)
    });
  }

  // 查看转发目的地记录, 且转发目的地已授权转发
  function findForwardVerifyAddress(domain, done) {
    EmailVerify.findOne({_id: domain.forward_email, passVerify: true}, function (err, emailV) {
      err = err ||
            emailV == null ? new Error("never found email record") : null;
      done(err, domain, emailV.email);
    });
  }

  // 确保发送者,和转发目的地不是同一个地址
  function makeSureForwardAddressWasNotEqualSendAddress(domain, address, done) {
    var fromAddress = mail_from.user + "@" + mail_from.host;
    console.log("fromAddress == address", fromAddress, address, fromAddress == address);
    if (fromAddress == address) {
      var err = new Error("请不要转发邮件给自己, 有的邮箱会拒绝接收,转发给自己的邮件")
      return done(err)
    }

    done(null, domain, address);
  }

  // 查看 转发是否超出限额, 并且计数
  // 如果不是流量包不足, 可以让发送邮件的帮她购买流量包...o^|^o...
  // 当然,顺便发送一封邮件到用户的转发目的地里...o^|^o...该交钱了,娃
  function makeSureUserHasEnoughForwardCount(domain, address, done) {
    var q = {
      user: domain.user,
      expireAt: {
        $gte: m().subtract(1, "days") // 往后延一天
      }
    }

    feePlan.find(q).sort({expireAt: 1}).exec(function (err, plans) {
      if (err) {
        return done(err);
      }
      console.log(plans);
      for (planIdx in plans) {
        var plan = plans[planIdx];
        if (plan.availCount == -1 || plan.usedCount < plan.availCount) {
          plan.usedCount += 1;
          return done(null, domain, address);
        }
      }
      return done(new Error("account was not pay fee"))
    });
  }


  async.waterfall([
    // 查看域名是否存在, 且通过验证
    existVerifyDomain,
    // 查看发送目的地(rcpt_to.user @ rcpt_to.host)是否处于废弃地址中
    addressWasNotReject,
    // 查看转发目的地记录, 且转发目的地已授权转发
    findForwardVerifyAddress,
    // 确保发送者,和转发目的地不是同一个地址
    makeSureForwardAddressWasNotEqualSendAddress,
    // 查看 转发是否超出限额, 并且计数
    // 如果不是流量包不足, 可以让发送邮件的帮她购买流量包...o^|^o...
    // 当然,顺便发送一封邮件到用户的转发目的地里...o^|^o...该交钱了,娃
    makeSureUserHasEnoughForwardCount
  ], function (err, domain, address) {
    cb(err, address || null);
  });
}
