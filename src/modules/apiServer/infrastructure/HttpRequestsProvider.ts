import {RequestsProvider} from "../domain/RequestsProvider";
import {ASRequest} from "../domain/entity/ASRequest";
import {ASResponse} from "../domain/entity/ASResponse";
import ErrorResponse from "../domain/entity/ASErrorResponse";
import BaseLogger from "../../logger/domain/BaseLogger";
import JSONSerializer from "../../serialize/JSONSerializator";
const Diet = require('diet')

type Wrapper<T> = { [P in keyof T]: T[P] }

type RequestType = Wrapper<typeof ASRequest>

export default class HttpRequestsProvider extends RequestsProvider {
    private _app: any
    private _supportedRequests: RequestType[]
    private _logger: BaseLogger

    private _requestsCallback: ((
        request: ASRequest,
        answerRequest: (response: ASResponse) => void
    ) => void) | null

    constructor(
        logger: BaseLogger,
        port: number,
        ...supportedRequests: RequestType[]
    ) {
        super()
        this._logger = logger
        this._supportedRequests = supportedRequests
        this._requestsCallback = null

        const app = Diet({ silent: true })
        this._app = app

        app.listen(`127.0.0.1:${port}`)

        this._logger.log('HttpRequestsProvider', `Started listening at 127.0.0.1:${port}`)
        this._logger.log(
            'HttpRequestsProvider supported requests:\n',
            supportedRequests
                .map(r => r.prototype.constructor.name)
                .join('\n')
        )

        this._supportedRequests.forEach(request => {
            let queryPath = request.getQueryPath()
            let type = request.getQueryType()

            this.setupMethod(
                request,
                type,
                queryPath
            )
        })
    }

    public getRequests(
        callback: (
            request: ASRequest,
            answerRequest: (response: ASResponse) => void
        ) => void
    ) {
        this._requestsCallback = callback
    }

    private setupMethod(
        request: any,
        type: string,
        path: string,
    ) {
        this._app[type](path, ($: any) => {
            if (!this._requestsCallback)
                throw new Error('No request callback')

            try {
                let data = type == 'post' ? $.body : $.query

                if (!data)
                    $.end(JSON.stringify(JSONSerializer.serialize(new ErrorResponse('No data passed'))))

                let deserializedRequest: ASRequest = JSONSerializer.deserialize(
                    request,
                    type == 'post' ? $.body : $.query
                )


                this._requestsCallback(
                    deserializedRequest,
                    (response: ASResponse) => {
                        $.end(JSON.stringify(JSONSerializer.serialize(response)))
                    }
                )
            }
            catch (e) {
                $.end(JSON.stringify(JSONSerializer.serialize(new ErrorResponse(e.message))))
            }
        })
    }
}